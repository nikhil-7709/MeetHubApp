/**
 * MeetHub – Full Real-Time Meeting Room
 * Features: Real Camera Video · Real Mic · Screen Share · Chat · Participants · Invite · Flip Camera
 * Supports Web (native HTML5 WebRTC video) & Mobile (react-native-webrtc / dev builds)
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { createMeeting, endMeeting, getMeeting, joinMeeting } from '../../src/services/meetingServiceUnified';
import { subscribeToMeetingMessages, sendMeetingMessage } from '../../src/services/meetingChatService';
import { joinWebRtcRoom, type WebRtcRoom, type RemotePeer } from '../../src/services/webrtcService';
import type { Meeting, MeetingMessage } from '../../src/types';
import { formatMeetingInvite, getMeetingWebLink } from '../../src/utils/meetingLink';

// ── Native RTCView resolver (for mobile dev clients) ──────────────────────────
type RTCViewType = React.ComponentType<{
  streamURL: string;
  style?: object;
  objectFit?: string;
  mirror?: boolean;
}>;

let _rtcViewCache: RTCViewType | null | undefined = undefined;

function getRTCView(): RTCViewType | null {
  if (_rtcViewCache !== undefined) return _rtcViewCache;
  if (Platform.OS === 'web') {
    _rtcViewCache = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('react-native-webrtc') as { RTCView: RTCViewType };
    _rtcViewCache = m.RTCView ?? null;
  } catch {
    _rtcViewCache = null;
  }
  return _rtcViewCache;
}

// ── Color Theme ────────────────────────────────────────────────────────────────
const { height: SCREEN_H } = Dimensions.get('window');
const COLORS = {
  bg: '#080B14',
  surface: '#111827',
  card: '#161F30',
  border: 'rgba(255, 255, 255, 0.08)',
  primary: '#2563EB',
  primaryGlow: 'rgba(37, 99, 235, 0.35)',
  danger: '#EF4444',
  dangerGlow: 'rgba(239, 68, 68, 0.35)',
  success: '#10B981',
  warning: '#F59E0B',
  text: '#F8FAFC',
  muted: '#94A3B8',
  dockBg: 'rgba(15, 23, 42, 0.92)',
};

type Panel = 'none' | 'chat' | 'participants' | 'invite';

// ── Web Video Player Component ────────────────────────────────────────────────
function WebVideoPlayer({
  stream,
  isLocal,
  isScreenShare = false,
}: {
  stream: unknown;
  isLocal: boolean;
  isScreenShare?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      try {
        videoRef.current.srcObject = stream as MediaStream;
        videoRef.current.play().catch(() => {});
      } catch {
        /* ignore */
      }
    }
  }, [stream]);

  if (Platform.OS !== 'web') return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: isScreenShare ? 'contain' : 'cover',
        transform: isLocal && !isScreenShare ? 'scaleX(-1)' : 'none',
        borderRadius: 20,
        backgroundColor: '#000',
      }}
    />
  );
}

// ── Web Dedicated Audio Player Component (Guarantees voice audio even if camera is off)
function WebAudioPlayer({ stream }: { stream: unknown }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      try {
        audioRef.current.srcObject = stream as MediaStream;
        audioRef.current.play().catch(() => {});
      } catch {
        /* ignore */
      }
    }
  }, [stream]);

  if (Platform.OS !== 'web') return null;

  return (
    <audio
      ref={audioRef}
      autoPlay
      style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
    />
  );
}

// ── Participant Tile ──────────────────────────────────────────────────────────
function ParticipantTile({
  name,
  stream,
  muted,
  videoOff,
  isLocal,
  isLarge,
  isScreenSharing = false,
  onStopScreenShare,
}: {
  name: string;
  stream: unknown | null;
  muted: boolean;
  videoOff: boolean;
  isLocal: boolean;
  isLarge: boolean;
  isScreenSharing?: boolean;
  onStopScreenShare?: () => void;
}) {
  const [antiMirrorActive, setAntiMirrorActive] = useState(false);
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const streamObj = stream as { toURL?: () => string } | null;
  const RTCView = getRTCView();
  const hasRealStream = Boolean(stream && !videoOff);

  return (
    <View style={[styles.tile, isLarge ? styles.tileLarge : styles.tileSmall]}>
      {/* Dedicated Remote Audio Playback on Web */}
      {!isLocal && stream && Platform.OS === 'web' ? (
        <WebAudioPlayer stream={stream} />
      ) : null}

      {/* 1. Optional Anti-Mirror Mode (when presenter manually chooses to pause live preview) */}
      {isLocal && isScreenSharing && antiMirrorActive ? (
        <View style={styles.presentingContainer}>
          <View style={[styles.presentingGlow, isLarge && styles.presentingGlowLarge]}>
            <View style={[styles.presentingCircle, isLarge && styles.presentingCircleLarge]}>
              <MaterialCommunityIcons
                name="monitor-share"
                size={isLarge ? 48 : 28}
                color="#10B981"
              />
            </View>
          </View>
          <Text style={[styles.presentingTitle, isLarge && styles.presentingTitleLarge]}>
            Anti-Mirror Mode Active
          </Text>
          <Text style={[styles.presentingSub, isLarge && styles.presentingSubLarge]}>
            Your screen is broadcasting to all participants. Live preview is paused here to avoid self-reflection.
          </Text>
          <View style={styles.antiMirrorBtnRow}>
            <TouchableOpacity
              style={styles.antiMirrorToggleBtn}
              onPress={() => setAntiMirrorActive(false)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="eye-outline" size={16} color="#FFFFFF" />
              <Text style={styles.antiMirrorToggleBtnText}>Show Live Screen</Text>
            </TouchableOpacity>

            {onStopScreenShare && (
              <TouchableOpacity
                style={styles.stopPresentingBtn}
                onPress={onStopScreenShare}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="stop-circle" size={16} color="#FFFFFF" />
                <Text style={styles.stopPresentingBtnText}>Stop Sharing</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <>
          {/* 2. REAL Live Video rendering on Web (for camera AND screen share!) */}
          {Platform.OS === 'web' && hasRealStream ? (
            <WebVideoPlayer
              stream={stream}
              isLocal={isLocal}
              isScreenShare={isScreenSharing}
            />
          ) : null}

          {/* 3. REAL Video rendering on Native (react-native-webrtc) */}
          {Platform.OS !== 'web' && hasRealStream && RTCView && streamObj?.toURL ? (
            <RTCView
              streamURL={streamObj.toURL()}
              style={StyleSheet.absoluteFill}
              objectFit={isScreenSharing ? 'contain' : 'cover'}
              mirror={isLocal && !isScreenSharing}
            />
          ) : null}

          {/* 4. Fallback Avatar (when video is turned off or no video track) */}
          {videoOff || !hasRealStream ? (
            <View style={styles.tileAvatarWrap}>
              <View style={[styles.avatarGlow, isLarge && styles.avatarGlowLarge]}>
                <View style={[styles.avatarCircle, isLarge && styles.avatarCircleLarge]}>
                  <Text style={[styles.avatarText, isLarge && styles.avatarTextLarge]}>
                    {initials}
                  </Text>
                </View>
              </View>
              <View style={styles.videoOffPill}>
                <MaterialCommunityIcons name="video-off" size={13} color="#94A3B8" />
                <Text style={styles.videoOffText}>Camera off</Text>
              </View>
            </View>
          ) : null}

          {/* 5. Live Screen Share Floating Header Overlay */}
          {isScreenSharing && isLarge && (
            <View style={styles.liveScreenOverlay}>
              <View style={styles.liveScreenBadge}>
                <View style={styles.liveDotRed} />
                <Text style={styles.liveScreenBadgeText}>
                  {isLocal ? 'LIVE SCREEN SHARE' : `${name.toUpperCase()}'S SCREEN`}
                </Text>
              </View>

              {isLocal && (
                <View style={styles.liveScreenActionRow}>
                  <TouchableOpacity
                    style={styles.antiMirrorPillBtn}
                    onPress={() => setAntiMirrorActive(true)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="shield-outline" size={13} color="#94A3B8" />
                    <Text style={styles.antiMirrorPillText}>Anti-Mirror</Text>
                  </TouchableOpacity>

                  {onStopScreenShare && (
                    <TouchableOpacity
                      style={styles.liveStopPillBtn}
                      onPress={onStopScreenShare}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="stop-circle" size={13} color="#FFFFFF" />
                      <Text style={styles.liveStopPillText}>Stop Sharing</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* Name + Audio Indicator Badge */}
      <View style={styles.tileNameRow}>
        <View
          style={[
            styles.speakingIndicator,
            { backgroundColor: muted ? COLORS.danger : COLORS.success },
          ]}
        >
          <MaterialCommunityIcons
            name={muted ? 'microphone-off' : 'microphone'}
            size={11}
            color="white"
          />
        </View>
        <Text style={styles.tileName} numberOfLines={1}>
          {name.replace(/\s*\(You\)$/, '')}
          {isLocal ? ' (You)' : ''}
        </Text>
        {isScreenSharing && (
          <View style={styles.presentingNameChip}>
            <MaterialCommunityIcons name="monitor-share" size={11} color="#10B981" />
            <Text style={styles.presentingNameChipText}>Sharing</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function MeetingRoomScreen() {
  const { meetingId, camera, microphone } = useLocalSearchParams<{
    meetingId: string;
    camera?: string;
    microphone?: string;
  }>();

  const { user, loading, signInAsGuest } = useAuth();
  const insets = useSafeAreaInsets();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Media states
  const [micOn, setMicOn] = useState(microphone !== 'false');
  const [camOn, setCamOn] = useState(camera !== 'false');
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  // WebRTC
  const rtcRoom = useRef<WebRtcRoom | null>(null);
  const [localStream, setLocalStream] = useState<unknown | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const sessionPeerIdRef = useRef<string>(
    `${user?.uid || 'guest'}_${Math.random().toString(36).substring(2, 8)}`,
  );

  // Sliding panels
  const [panel, setPanel] = useState<Panel>('none');
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const chatListRef = useRef<FlatList>(null);

  // Large participant switch
  const [showLargeView, setShowLargeView] = useState<string | null>(null);

  // Responsive layout dimensions
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 768;
  const chatWidth = isWide ? 380 : Math.min(380, windowWidth - 24);
  const chatRight = isWide ? 20 : 12;
  const chatTop = insets.top + (isWide ? 68 : 60);
  const chatBottom = insets.bottom + 92;

  // Animations
  const panelAnim = useRef(new Animated.Value(0)).current;   // bottom sheet (0→1)
  const chatAnim  = useRef(new Animated.Value(450)).current; // chat sidebar (slides in from right)

  const isHost = meeting?.hostId === user?.uid;

  const triggerHaptic = useCallback(() => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* ignore */
    }
  }, []);

  // Bottom-sheet animation (participants / invite)
  useEffect(() => {
    const isSheet = panel === 'participants' || panel === 'invite';
    Animated.spring(panelAnim, {
      toValue: isSheet ? 1 : 0,
      useNativeDriver: false,
      tension: 70,
      friction: 12,
    }).start();
  }, [panel, panelAnim]);

  // Chat sidebar animation (slides in from right)
  useEffect(() => {
    Animated.spring(chatAnim, {
      toValue: panel === 'chat' ? 0 : chatWidth + 40,
      useNativeDriver: true,
      tension: 75,
      friction: 13,
    }).start();
  }, [panel, chatAnim, chatWidth]);

  const chatOpacity = chatAnim.interpolate({
    inputRange: [0, chatWidth + 20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panelHeight = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_H * 0.58],
  });

  // Auto-authenticate guest if joining via direct connection link
  useEffect(() => {
    if (!loading && !user) {
      void signInAsGuest(`Guest_${Math.random().toString(36).slice(2, 6)}`);
    }
  }, [loading, user, signInAsGuest]);

  // ── Initialize Meeting & WebRTC ─────────────────────────────────────────────
  useEffect(() => {
    if (!user || !meetingId) return;
    let unsubChat: (() => void) | null = null;
    let isCancelled = false;

    (async () => {
      try {
        let m = await getMeeting(meetingId);
        const resolvedParticipantName =
          user.displayName && !/^guest/i.test(user.displayName)
            ? user.displayName
            : user.email === 'vipnikhilpatil7709@gmail.com'
            ? 'Nikhil Patil'
            : user.displayName || user.email || 'Participant';

        // Auto-provision room if opened via direct link or code so users never get "Meeting not found"
        if (!m) {
          try {
            m = await createMeeting(
              {
                meetingId: meetingId.trim().toUpperCase(),
                title: `${resolvedParticipantName}'s Meeting`,
                description: 'Instant meeting room',
                hostId: user.uid,
                hostName: resolvedParticipantName,
                scheduledDate: Date.now(),
                startTime: Date.now(),
                endTime: Date.now() + 2 * 60 * 60 * 1000,
              },
              'active',
            );
          } catch {
            m = null;
          }
        }

        if (!m) {
          setError('Meeting not found.');
          setBusy(false);
          return;
        }
        if (m.status === 'ended') {
          setError('This meeting has already ended.');
          setBusy(false);
          return;
        }

        await joinMeeting(m.meetingId, user.uid).catch(() => null);
        if (isCancelled) return;
        setMeeting(m);
        setBusy(false);

        // Chat subscription
        unsubChat = subscribeToMeetingMessages(m.meetingId, (msgs) => {
          setMessages(msgs);
          if (panel !== 'chat') {
            setUnreadCount((c) => c + 1);
          }
        });

        // WebRTC room connection
        const room = await joinWebRtcRoom(
          m.meetingId,
          sessionPeerIdRef.current,
          resolvedParticipantName,
          { camera: camera !== 'false', mic: microphone !== 'false' },
          (peers) => {
            if (!isCancelled) {
              setRemotePeers(Array.from(peers.values()));
            }
          },
        );

        if (!isCancelled) {
          rtcRoom.current = room;
          setLocalStream(room.localStream);
          setMicOn(room.isMicOn);
          setCamOn(room.isCameraOn);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Could not join meeting.');
          setBusy(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
      unsubChat?.();
      rtcRoom.current?.hangUp();
      rtcRoom.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, user]);

  // Duration timer
  useEffect(() => {
    if (!meeting) return;
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [meeting]);

  const elapsed = `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`;

  // ── Button Handlers ──────────────────────────────────────────────────────────

  // 1. Toggle Microphone
  const handleToggleMic = useCallback(async () => {
    triggerHaptic();
    const room = rtcRoom.current;
    if (room) {
      const next = await room.toggleMic();
      setMicOn(next);
    } else {
      setMicOn((v) => !v);
    }
  }, [triggerHaptic]);

  // 2. Toggle Camera
  const handleToggleCamera = useCallback(async () => {
    triggerHaptic();
    const room = rtcRoom.current;
    if (room) {
      const next = await room.toggleCamera();
      setCamOn(next);
      setLocalStream(room.localStream);
    } else {
      setCamOn((v) => !v);
    }
  }, [triggerHaptic]);

  // 3. Flip Camera
  const handleFlipCamera = useCallback(async () => {
    triggerHaptic();
    const room = rtcRoom.current;
    if (room) {
      await room.flipCamera();
      setLocalStream(room.localStream);
    }
  }, [triggerHaptic]);

  // 4. Toggle Screen Share
  const handleScreenShare = useCallback(async () => {
    triggerHaptic();
    const room = rtcRoom.current;
    if (!room) return;
    try {
      const next = await room.toggleScreenShare();
      setScreenSharing(next);
      setLocalStream(room.localStream);
      if (next) setCamOn(false);
    } catch {
      /* ignore */
    }
  }, [triggerHaptic]);

  // 5. Open / Toggle Panels
  const handleOpenPanel = useCallback(
    (p: Panel) => {
      triggerHaptic();
      setPanel((prev) => (prev === p ? 'none' : p));
      if (p === 'chat') setUnreadCount(0);
    },
    [triggerHaptic],
  );

  // 6. Send Chat Message
  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || !user || !meetingId) return;
    const text = chatInput.trim();
    setChatInput('');
    await sendMeetingMessage(
      meetingId,
      user.uid,
      user.displayName || user.email || 'Participant',
      text,
    ).catch(() => null);
    setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatInput, user, meetingId]);

  // 7. Copy Room Code
  const handleCopyCode = useCallback(async () => {
    if (!meeting) return;
    triggerHaptic();
    await Clipboard.setStringAsync(meeting.meetingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }, [meeting, triggerHaptic]);

  // 7b. Copy Real Connection Web Link
  const handleCopyLink = useCallback(async () => {
    if (!meeting) return;
    triggerHaptic();
    const link = getMeetingWebLink(meeting.meetingId);
    await Clipboard.setStringAsync(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  }, [meeting, triggerHaptic]);

  // 8. Share Room Invite
  const handleShareInvite = useCallback(async () => {
    if (!meeting) return;
    triggerHaptic();
    const invite = formatMeetingInvite({
      meetingId: meeting.meetingId,
      title: meeting.title,
      hostName: meeting.hostName,
    });
    await Share.share({
      title: invite.title,
      message: invite.message,
      url: invite.url,
    }).catch(() => {});
  }, [meeting, triggerHaptic]);

  // 9. Leave & End Call logic (cross-platform modal support)
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const openLeaveModal = useCallback(() => {
    triggerHaptic();
    setShowLeaveModal(true);
  }, [triggerHaptic]);

  useEffect(() => {
    if (!showLeaveModal) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowLeaveModal(false);
      return true;
    });
    return () => sub.remove();
  }, [showLeaveModal]);

  const executeLeave = useCallback(
    async (endForAll = false) => {
      setShowLeaveModal(false);
      triggerHaptic();

      // 1. If host ends meeting for all, update Firestore/demo state
      if (endForAll && meetingId) {
        try {
          await endMeeting(meetingId);
        } catch {
          /* ignore */
        }
      }

      // 2. Stop all camera & mic hardware tracks so device hardware indicators turn off
      if (localStream) {
        try {
          const s = localStream as { getTracks?: () => { stop: () => void }[] };
          s.getTracks?.().forEach((t) => t.stop());
        } catch {
          /* ignore */
        }
      }

      // 3. Hang up WebRTC peer connections and signaling socket
      try {
        rtcRoom.current?.hangUp();
      } catch {
        /* ignore */
      }
      rtcRoom.current = null;

      // 4. Return to home tab immediately
      router.replace('/(tabs)');
    },
    [localStream, meetingId, triggerHaptic],
  );

  // Participant list calculation
  const allParticipants = useMemo(() => {
    const localName =
      user?.displayName && !/^guest/i.test(user.displayName)
        ? user.displayName
        : user?.email === 'vipnikhilpatil7709@gmail.com'
        ? 'Nikhil Patil'
        : user?.displayName || user?.email || 'You';

    const local = {
      peerId: sessionPeerIdRef.current,
      name: localName,
      stream: localStream,
      audioMuted: !micOn,
      videoMuted: !camOn && !screenSharing,
      isScreenSharing: screenSharing,
      isLocal: true,
    };
    const remotes = remotePeers.map((p) => ({
      ...p,
      isScreenSharing: Boolean(p.isScreenSharing),
      isLocal: false,
    }));
    return [local, ...remotes];
  }, [user, localStream, micOn, camOn, screenSharing, remotePeers]);

  const largeParticipant = useMemo(() => {
    if (showLargeView) {
      return allParticipants.find((p) => p.peerId === showLargeView) ?? allParticipants[0];
    }
    // Spotlight participant who is sharing screen
    const screenSharer = allParticipants.find((p) => p.isScreenSharing);
    if (screenSharer) return screenSharer;

    return allParticipants[0];
  }, [allParticipants, showLargeView]);

  const thumbnailParticipants = useMemo(
    () => allParticipants.filter((p) => p.peerId !== largeParticipant?.peerId),
    [allParticipants, largeParticipant],
  );

  // Loading Screen
  if (busy) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.bg }]}>
        <View style={styles.loadingPulse}>
          <MaterialCommunityIcons name="video-wireless-outline" size={42} color={COLORS.primary} />
        </View>
        <Text style={styles.loadingText}>Connecting to room…</Text>
        <Text style={styles.loadingSubText}>Activating camera & audio stream</Text>
      </View>
    );
  }

  // Error / Meeting Ended Screen
  if (error) {
    const isMeetingEnded = error.toLowerCase().includes('ended');
    return (
      <View
        style={[
          styles.center,
          {
            flex: 1,
            backgroundColor: COLORS.bg,
            padding: 32,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View
          style={[
            styles.errorIcon,
            isMeetingEnded && { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
          ]}
        >
          <MaterialCommunityIcons
            name={isMeetingEnded ? 'video-off-outline' : 'alert-circle-outline'}
            size={42}
            color={isMeetingEnded ? COLORS.warning : COLORS.danger}
          />
        </View>
        <Text style={[styles.errorTitle, { textAlign: 'center', marginBottom: 8 }]}>
          {isMeetingEnded ? 'Meeting Ended' : 'Unable to join'}
        </Text>
        <Text style={[styles.errorSub, { marginBottom: 28, paddingHorizontal: 16 }]}>
          {isMeetingEnded
            ? 'This meeting has been ended by the host. Thank you for joining!'
            : error}
        </Text>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => [
            styles.errorBtn,
            { width: '100%', maxWidth: 280 },
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.errorBtnText}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ═══ TOP FLOATING HEADER ═══════════════════════════════════════════ */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topLeft}>
          <Pressable onPress={openLeaveModal} style={styles.topBackBtn} hitSlop={12}>
            <MaterialCommunityIcons name="chevron-down" size={22} color="white" />
          </Pressable>
          <View style={styles.titleCol}>
            <Text style={styles.meetingTitle} numberOfLines={1} ellipsizeMode="tail">
              {meeting?.title ?? 'Meeting'}
            </Text>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTimer}>{elapsed}</Text>
              <Text style={styles.participantCount} numberOfLines={1}>
                · {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.topRight}>
          {/* Flip Camera Button */}
          {camOn && !screenSharing && (
            <Pressable onPress={handleFlipCamera} style={styles.flipBtn} hitSlop={8}>
              <MaterialCommunityIcons name="camera-flip-outline" size={18} color="white" />
            </Pressable>
          )}

          {/* Meeting Code Chip */}
          <Pressable onPress={handleCopyCode} style={styles.codeChip}>
            <MaterialCommunityIcons
              name={copied ? 'check-circle' : 'content-copy'}
              size={13}
              color={copied ? '#10B981' : '#94A3B8'}
            />
            <Text style={[styles.codeText, copied && { color: '#10B981' }]}>
              {copied ? 'Copied!' : meeting?.meetingId}
            </Text>
          </Pressable>

          {/* Red Leave Action Button */}
          <Pressable
            onPress={openLeaveModal}
            style={({ pressed }) => [
              styles.topLeaveBtn,
              pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
            ]}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="phone-hangup" size={13} color="white" />
            <Text style={styles.topLeaveText}>Leave</Text>
          </Pressable>
        </View>
      </View>

      {/* ═══ VIDEO AREA ═══════════════════════════════════════════════════════ */}
      <View style={styles.videoArea}>
        {/* Hand Raised Floating Banner */}
        {handRaised && (
          <View style={styles.handRaisedBanner}>
            <MaterialCommunityIcons name="hand-back-right" size={16} color="#F59E0B" />
            <Text style={styles.handRaisedText}>You raised your hand</Text>
          </View>
        )}

        {/* Screen Share Floating Indicator */}
        {screenSharing && (
          <View style={styles.screenShareBanner}>
            <MaterialCommunityIcons name="monitor-share" size={16} color="#FFFFFF" />
            <Text style={styles.screenShareText}>You are sharing your screen</Text>
            <TouchableOpacity
              onPress={handleScreenShare}
              style={styles.screenShareBannerBtn}
              hitSlop={8}
            >
              <Text style={styles.screenShareBannerBtnText}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Video Viewport */}
        {largeParticipant && (
          <ParticipantTile
            name={largeParticipant.name}
            stream={largeParticipant.stream}
            muted={largeParticipant.audioMuted}
            videoOff={largeParticipant.videoMuted}
            isLocal={largeParticipant.isLocal}
            isLarge
            isScreenSharing={largeParticipant.isScreenSharing}
            onStopScreenShare={handleScreenShare}
          />
        )}

        {/* Thumbnail Filmstrip (when multiple participants) */}
        {thumbnailParticipants.length > 0 && (
          <ScrollView
            horizontal
            style={styles.thumbnailStrip}
            contentContainerStyle={{ gap: 10, padding: 8 }}
            showsHorizontalScrollIndicator={false}
          >
            {thumbnailParticipants.map((p) => (
              <TouchableOpacity
                key={p.peerId}
                onPress={() => setShowLargeView(p.peerId)}
                activeOpacity={0.8}
              >
                <ParticipantTile
                  name={p.name}
                  stream={p.stream}
                  muted={p.audioMuted}
                  videoOff={p.videoMuted}
                  isLocal={p.isLocal}
                  isLarge={false}
                  isScreenSharing={p.isScreenSharing}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ═══ BOTTOM SHEET (Participants / Invite) ═══════════════════════════════ */}
      <Animated.View style={[styles.slidePanel, { height: panelHeight }]}>
        {/* Participants Panel */}
        {panel === 'participants' && (
          <View style={styles.panelInner}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHandle} />
              <Text style={styles.panelTitle}>Participants ({allParticipants.length})</Text>
              <Pressable onPress={() => setPanel('none')} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={20} color={COLORS.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {allParticipants.map((p) => (
                <View key={p.peerId} style={styles.participantRow}>
                  <View style={styles.participantAvatar}>
                    <Text style={styles.participantAvatarText}>
                      {(p.name || '?').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.participantName} numberOfLines={1}>
                    {p.name.replace(/\s*\(You\)$/, '')}
                    {p.isLocal ? ' (You)' : ''}
                    {p.peerId === meeting?.hostId ? ' · Host' : ''}
                  </Text>
                  <View style={styles.participantIcons}>
                    <MaterialCommunityIcons
                      name={p.audioMuted ? 'microphone-off' : 'microphone'}
                      size={16}
                      color={p.audioMuted ? COLORS.danger : COLORS.success}
                    />
                    <MaterialCommunityIcons
                      name={p.videoMuted ? 'video-off' : 'video'}
                      size={16}
                      color={p.videoMuted ? COLORS.danger : COLORS.success}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Invite Panel */}
        {panel === 'invite' && (
          <View style={styles.panelInner}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHandle} />
              <Text style={styles.panelTitle}>Invite to Meeting</Text>
              <Pressable onPress={() => setPanel('none')} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={20} color={COLORS.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
              {/* 1. Direct Web Connection Link */}
              <Text style={styles.inviteLabel}>DIRECT CONNECTION LINK (INSTANT BROWSER JOIN)</Text>
              <Pressable onPress={handleCopyLink} style={styles.codeBox}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text
                    style={[styles.codeBoxText, { fontSize: 13, letterSpacing: 0.3, color: '#38BDF8' }]}
                    numberOfLines={1}
                  >
                    {meeting ? getMeetingWebLink(meeting.meetingId) : '...'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                    Works in any browser on phone or PC • No install required
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: copiedLink ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <MaterialCommunityIcons
                    name={copiedLink ? 'check' : 'link-variant'}
                    size={16}
                    color={copiedLink ? COLORS.success : '#38BDF8'}
                  />
                  <Text
                    style={{
                      color: copiedLink ? COLORS.success : '#38BDF8',
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {copiedLink ? 'Copied' : 'Copy'}
                  </Text>
                </View>
              </Pressable>

              {/* 2. Room Code */}
              <Text style={styles.inviteLabel}>MEETING ROOM CODE</Text>
              <Pressable onPress={handleCopyCode} style={styles.codeBox}>
                <Text style={styles.codeBoxText}>{meeting?.meetingId}</Text>
                <View
                  style={{
                    backgroundColor: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(96, 165, 250, 0.15)',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <MaterialCommunityIcons
                    name={copied ? 'check' : 'content-copy'}
                    size={16}
                    color={copied ? COLORS.success : COLORS.primary}
                  />
                  <Text
                    style={{
                      color: copied ? COLORS.success : '#60A5FA',
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Text>
                </View>
              </Pressable>

              {/* 3. Share Button */}
              <Pressable onPress={handleShareInvite} style={styles.shareBtn}>
                <MaterialCommunityIcons name="share-variant-outline" size={18} color="white" />
                <Text style={styles.shareBtnText}>Share Invitation Link</Text>
              </Pressable>

              <Text style={styles.inviteHint}>
                Teammates can tap the link to join directly in Chrome/Safari from any device, or enter the code under &apos;Join Meeting&apos;.
              </Text>
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* ═══ FLOATING CHAT SIDEBAR (Right-side panel) ═══════════════════ */}
      <Animated.View
        style={[
          styles.chatSidebar,
          {
            right: chatRight,
            top: chatTop,
            bottom: chatBottom,
            width: chatWidth,
            transform: [{ translateX: chatAnim }],
            opacity: chatOpacity,
          },
        ]}
        pointerEvents={panel === 'chat' ? 'auto' : 'none'}
      >
        {/* Popup header */}
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarHeaderLeft}>
            <MaterialCommunityIcons name="chat-processing-outline" size={16} color={COLORS.primary} />
            <Text style={styles.sidebarTitle}>In-Call Messages</Text>
            {messages.length > 0 && (
              <View style={styles.msgCountPill}>
                <Text style={styles.msgCountText}>{messages.length}</Text>
              </View>
            )}
          </View>
          <Pressable onPress={() => setPanel('none')} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={18} color={COLORS.muted} />
          </Pressable>
        </View>

        {/* Messages list */}
        <FlatList
          ref={chatListRef}
          data={messages}
          keyExtractor={(m) => m.messageId}
          style={{ flex: 1 }}
          renderItem={({ item }) => {
            const own = item.senderId === (user?.uid ?? '');
            const time =
              typeof item.timestamp === 'number'
                ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';
            return (
              <View style={[styles.msgRow, own ? styles.msgRowOwn : styles.msgRowOther]}>
                <View style={styles.msgBubbleCol}>
                  {!own && (
                    <Text style={styles.msgSenderName}>{item.senderName}</Text>
                  )}
                  <View style={[styles.msgBubble, own ? styles.msgBubbleOwn : styles.msgBubbleOther]}>
                    <Text style={[styles.msgText, own && styles.msgTextOwn]}>{item.message}</Text>
                    <Text style={[styles.msgTime, own && styles.msgTimeOwn]}>{time}</Text>
                  </View>
                </View>
              </View>
            );
          }}
          contentContainerStyle={messages.length ? styles.msgList : styles.msgListEmpty}
          ListEmptyComponent={
            <View style={styles.sidebarEmpty}>
              <MaterialCommunityIcons name="chat-sleep-outline" size={28} color={COLORS.muted} />
              <Text style={[styles.sidebarEmptyText, { fontSize: 12 }]}>Say hello! 👋</Text>
            </View>
          }
          onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />

        {/* Composer */}
        <View style={styles.sidebarComposer}>
          <TextInput
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Message…"
            placeholderTextColor={COLORS.muted}
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleSendChat}
            style={styles.sidebarInput}
          />
          <Pressable
            onPress={handleSendChat}
            disabled={!chatInput.trim()}
            style={({ pressed }) => [
              styles.sidebarSendBtn,
              !chatInput.trim() && { opacity: 0.4 },
              pressed && { transform: [{ scale: 0.9 }] },
            ]}
          >
            <MaterialCommunityIcons name="send" size={16} color="white" />
          </Pressable>
        </View>
      </Animated.View>


      {/* ═══ MODERN FLOATING CAPSULE CONTROL DOCK ═════════════════════════ */}
      <View style={[styles.dockWrapper, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
        <View style={styles.modernDock}>
          <View style={styles.modernDockRow}>

            {/* 1. Mic */}
            <DockButton
              icon={micOn ? 'microphone' : 'microphone-off'}
              label={micOn ? 'Mic' : 'Muted'}
              active={!micOn}
              activeBg="rgba(239, 68, 68, 0.24)"
              activeColor="#EF4444"
              onPress={handleToggleMic}
            />

            {/* 2. Camera */}
            <DockButton
              icon={camOn ? 'video' : 'video-off'}
              label={camOn ? 'Cam' : 'Off'}
              active={!camOn}
              activeBg="rgba(239, 68, 68, 0.24)"
              activeColor="#EF4444"
              onPress={handleToggleCamera}
            />

            {/* 3. Screen Share */}
            <DockButton
              icon={screenSharing ? 'monitor-off' : 'monitor-share'}
              label={screenSharing ? 'Stop' : 'Share'}
              active={screenSharing}
              activeBg="rgba(16, 185, 129, 0.25)"
              activeColor="#10B981"
              onPress={handleScreenShare}
            />

            {/* 4. Raise Hand */}
            <DockButton
              icon={handRaised ? 'hand-back-right' : 'hand-back-right-outline'}
              label={handRaised ? 'Lower' : 'Hand'}
              active={handRaised}
              activeBg="rgba(245, 158, 11, 0.25)"
              activeColor="#F59E0B"
              onPress={() => {
                triggerHaptic();
                setHandRaised((v) => !v);
              }}
            />

            {/* 5. Chat */}
            <View style={styles.dockBtnWrap}>
              <DockButton
                icon="message-text-outline"
                label="Chat"
                active={panel === 'chat'}
                activeBg="rgba(37, 99, 235, 0.28)"
                activeColor="#60A5FA"
                onPress={() => handleOpenPanel('chat')}
              />
              {unreadCount > 0 && panel !== 'chat' && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </View>

            {/* 6. People */}
            <DockButton
              icon="account-group-outline"
              label="People"
              active={panel === 'participants'}
              activeBg="rgba(37, 99, 235, 0.28)"
              activeColor="#60A5FA"
              onPress={() => handleOpenPanel('participants')}
            />

            {/* 7. Invite */}
            <DockButton
              icon="link-variant"
              label="Invite"
              active={panel === 'invite'}
              activeBg="rgba(37, 99, 235, 0.28)"
              activeColor="#60A5FA"
              onPress={() => handleOpenPanel('invite')}
            />

            {/* 8. Leave */}
            <Pressable
              onPress={openLeaveModal}
              style={({ pressed }) => [
                styles.modernDockBtn,
                pressed && { transform: [{ scale: 0.92 }], opacity: 0.8 },
              ]}
              hitSlop={6}
            >
              <View style={[styles.modernDockCircle, styles.leaveDockCircle]}>
                <MaterialCommunityIcons name="phone-hangup" size={18} color="white" />
              </View>
              <Text style={[styles.modernDockLabel, styles.leaveDockLabel]} numberOfLines={1}>
                Leave
              </Text>
            </Pressable>

          </View>
        </View>
      </View>

      {/* ═══ LEAVE / END MEETING CONFIRMATION DIALOG (Google Meet Style) ═══ */}
      {showLeaveModal && (
        <View style={styles.modalOverlay}>
          {/* Backdrop to dismiss on tap outside */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowLeaveModal(false)}
          />

          {/* Centered Dialog Card */}
          <View style={styles.leaveDialogCard}>
            {/* Header Icon */}
            <View style={styles.leaveIconBox}>
              <MaterialCommunityIcons name="phone-hangup" size={26} color="#EF4444" />
            </View>

            <Text style={styles.leaveTitle}>Leave meeting?</Text>
            <Text style={styles.leaveSub}>
              {isHost
                ? 'You are the host. Would you like to end the room for all participants or leave by yourself?'
                : 'Are you sure you want to leave this call? You can rejoin anytime.'}
            </Text>

            <View style={styles.leaveActionStack}>
              {isHost && (
                <Pressable
                  onPress={() => void executeLeave(true)}
                  style={({ pressed }) => [
                    styles.leaveActionButton,
                    styles.leaveEndForAllBtn,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <MaterialCommunityIcons name="phone-remove" size={18} color="white" />
                  <Text style={styles.leaveActionButtonText}>End meeting for all</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => void executeLeave(false)}
                style={({ pressed }) => [
                  styles.leaveActionButton,
                  isHost ? styles.leaveOnlyBtn : styles.leaveEndForAllBtn,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                ]}
              >
                <MaterialCommunityIcons
                  name={isHost ? 'logout-variant' : 'phone-hangup'}
                  size={18}
                  color="white"
                />
                <Text style={styles.leaveActionButtonText}>
                  {isHost ? 'Leave meeting only' : 'Leave meeting'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowLeaveModal(false)}
                style={({ pressed }) => [
                  styles.leaveActionButton,
                  styles.leaveCancelBtn,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.leaveCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Dock Button Helper ────────────────────────────────────────────────────────
function DockButton({
  icon,
  label,
  active = false,
  activeBg = COLORS.primary,
  activeColor = 'white',
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  active?: boolean;
  activeBg?: string;
  activeColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modernDockBtn,
        pressed && { transform: [{ scale: 0.9 }], opacity: 0.75 },
      ]}
      hitSlop={8}
    >
      <View
        style={[
          styles.modernDockCircle,
          active && { backgroundColor: activeBg, borderColor: activeColor },
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={active ? activeColor : '#E2E8F0'}
        />
      </View>
      <Text
        style={[
          styles.modernDockLabel,
          active && { color: activeColor, fontWeight: '700' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Center / Loading / Error
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingPulse: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  },
  loadingSubText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  errorTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '800',
  },
  errorSub: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 10,
  },
  errorBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  errorBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },

  // Floating Header
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 6,
    zIndex: 10,
    gap: 8,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
    marginRight: 6,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  topBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  meetingTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveTimer: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  participantCount: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  flipBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  codeText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  topLeaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  topLeaveText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Video Area
  videoArea: {
    flex: 1,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  handRaisedBanner: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 5,
  },
  handRaisedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  screenShareBanner: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 5,
  },
  screenShareText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  screenShareBannerBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 4,
  },
  screenShareBannerBtnText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  },

  // Presenter Mode / Anti-Mirror styles
  presentingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0F172A',
  },
  presentingGlow: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  presentingGlowLarge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    marginBottom: 16,
  },
  presentingCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentingCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  presentingTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  presentingTitleLarge: {
    fontSize: 22,
    marginBottom: 8,
  },
  presentingSub: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 260,
  },
  presentingSubLarge: {
    fontSize: 14,
    maxWidth: 420,
    marginBottom: 16,
  },
  antiMirrorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  antiMirrorBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  stopPresentingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  stopPresentingBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  presentingNameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  presentingNameChipText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
  },
  antiMirrorBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  antiMirrorToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  antiMirrorToggleBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },

  // Live Screen Floating Overlay on top of real video stream
  liveScreenOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  liveScreenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  liveDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveScreenBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveScreenActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  antiMirrorPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  antiMirrorPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  liveStopPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  liveStopPillText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  },

  // Participant Tile
  tile: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0B0F19',
  },
  tileLarge: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  tileSmall: {
    width: 120,
    height: 160,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tileAvatarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarGlowLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleLarge: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  avatarText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
  },
  avatarTextLarge: {
    fontSize: 38,
  },
  videoOffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  videoOffText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  tileNameRow: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    maxWidth: '85%',
  },
  speakingIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },

  thumbnailStrip: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    maxHeight: 170,
  },

  // Sliding Panel (bottom sheet for participants/invite)
  slidePanel: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  panelInner: {
    flex: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  panelHandle: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  panelTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },

  // Floating chat sidebar (right-side panel)
  chatSidebar: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 45,
    shadowColor: '#000',
    shadowOffset: { width: -3, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
    overflow: 'hidden',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0F172A',
  },
  sidebarHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  msgCountPill: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  msgCountText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
  },
  // kept for TS — no longer rendered
  chatOverlay: { position: 'absolute', zIndex: 0 },
  sidebarIconWrap: {},
  sidebarSub: {},
  sidebarCloseBtn: {},
  sidebarTitle: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
  },

  // Message rows — two-sided layout
  msgList: {
    padding: 14,
    gap: 4,
  },
  msgListEmpty: {
    flexGrow: 1,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
  },
  msgRowOwn: {
    flexDirection: 'row-reverse',   // own messages from the RIGHT
  },
  msgRowOther: {
    flexDirection: 'row',           // others from the LEFT
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    flexShrink: 0,
  },
  msgAvatarText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
  },
  msgSpacer: {
    width: 35,
  },
  msgBubbleCol: {
    maxWidth: '75%',
    flexShrink: 1,
  },
  msgSenderName: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
    marginLeft: 2,
  },
  msgBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  msgBubbleOwn: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
  },
  msgText: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 15,
    lineHeight: 22,
  },
  msgTextOwn: {
    color: 'white',
  },
  msgTime: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 11,
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  msgTimeOwn: {
    color: 'rgba(255,255,255,0.55)',
  },
  sidebarEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  sidebarEmptyText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sidebarEmptySub: {
    fontSize: 13,
    textAlign: 'center',
  },

  // Sidebar composer
  sidebarComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sidebarInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: 'white',
    fontSize: 12,
    maxHeight: 70,
  },
  sidebarSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Legacy aliases kept for ChatBubble (no longer rendered but avoids TS errors)
  bubble: { padding: 12, borderRadius: 16, maxWidth: '80%' },
  bubbleSelf: { alignSelf: 'flex-end', backgroundColor: COLORS.primary },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#1E293B' },
  bubbleSender: { color: '#93C5FD', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  bubbleText: { color: 'white', fontSize: 14 },
  bubbleTime: { color: 'rgba(255,255,255,0.5)', fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  chatInput: { flex: 1, backgroundColor: '#1E293B', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, color: 'white', fontSize: 14 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  chatList: { padding: 16, gap: 10 },
  emptyChat: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginTop: 40 },

  // Participants Panel
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarText: {
    color: '#60A5FA',
    fontSize: 15,
    fontWeight: '800',
  },
  participantName: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  participantIcons: {
    flexDirection: 'row',
    gap: 8,
  },

  // Invite Panel
  inviteLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  codeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  codeBoxText: {
    color: '#60A5FA',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
  },
  shareBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  inviteHint: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },

  // Modern Floating Capsule Control Dock
  dockWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    paddingTop: 6,
    zIndex: 30,
  },
  modernDock: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: 'rgba(10, 16, 30, 0.97)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
    paddingHorizontal: 4,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  modernDockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  // kept for TS compat — no longer used
  modernDockScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 0,
  },
  modernDockBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    paddingHorizontal: 1,
  },
  dockBtnWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  modernDockCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  leaveDockCircle: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  modernDockLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0,
    textAlign: 'center',
  },
  leaveDockLabel: {
    color: '#EF4444',
    fontWeight: '700',
  },
  dockDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 2,
  },
  modernEndCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
    marginLeft: 2,
  },
  modernEndCallText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: 0,
    backgroundColor: '#EF4444',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  unreadText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
  },

  // Leave Confirmation Centered Dialog (Google Meet Style)
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 9999,
    elevation: 9999,
  },
  leaveDialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  leaveIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  leaveTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  leaveSub: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 6,
    width: '100%',
  },
  leaveActionStack: {
    width: '100%',
    gap: 10,
  },
  leaveActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  leaveEndForAllBtn: {
    backgroundColor: '#EF4444',
  },
  leaveOnlyBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  leaveCancelBtn: {
    backgroundColor: 'transparent',
    minHeight: 40,
    paddingVertical: 8,
  },
  leaveActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  leaveCancelText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
