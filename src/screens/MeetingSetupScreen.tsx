import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import {
  createMeeting,
  getMeeting,
  joinMeeting,
  subscribeToMyMeetings,
} from '../services/meetingServiceUnified';
import type { Meeting } from '../types';
import { formatMeetingInvite, getMeetingWebLink, parseMeetingCode } from '../utils/meetingLink';

type SetupMode = 'create' | 'join';

export function MeetingSetupScreen({ initialMode = 'create' }: { initialMode?: SetupMode }) {
  const params = useLocalSearchParams<{ mode?: string; code?: string }>();
  const [mode, setMode] = useState<SetupMode>(
    params.mode === 'join' || initialMode === 'join' ? 'join' : 'create',
  );

  const { user } = useAuth();
  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const firstName = user?.displayName?.split(' ')[0] || 'My';
  const [title, setTitle] = useState(`${firstName}'s Meeting`);
  const [code, setCode] = useState(params.code || '');
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);

  // Generated code preview for the room being created
  const [generatedCode, setGeneratedCode] = useState('');

  useEffect(() => {
    // Generate clean preview code like MH-9K2L-47P
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const rand = (n: number) =>
      Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setGeneratedCode(`MH-${rand(4)}-${rand(3)}`);
  }, []);

  // Subscribe to user's recent meetings to show quick-join chips
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToMyMeetings(
      user.uid,
      (list) => {
        const activeOrRecent = list
          .filter((m) => m.status !== 'ended')
          .slice(0, 4);
        setRecentMeetings(activeOrRecent);
      },
      () => {},
    );
    return unsub;
  }, [user]);

  const triggerHaptic = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* ignore if unsupported */
    }
  };

  // ── Create and Start Instant Meeting ──────────────────────────────────────────
  const handleStartMeeting = async () => {
    if (!user) {
      setError('Please sign in to start a meeting.');
      return;
    }
    const meetingTitle = title.trim() || `${firstName}'s Meeting`;
    setError('');
    setBusy(true);
    triggerHaptic();

    try {
      const now = Date.now();
      const newMeeting = await createMeeting(
        {
          meetingId: generatedCode || undefined,
          title: meetingTitle,
          description: 'Instant meeting room created from MeetHub',
          hostId: user.uid,
          hostName: user.displayName || user.email || 'Host',
          scheduledDate: now,
          startTime: now,
          endTime: now + 2 * 60 * 60 * 1000,
        },
        'active',
      );

      // Navigate directly into the real meeting room
      router.replace({
        pathname: '/meeting/[meetingId]',
        params: {
          meetingId: newMeeting.meetingId,
          camera: String(cameraOn),
          microphone: String(micOn),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create meeting room.');
      setBusy(false);
    }
  };

  // ── Join Meeting by Code ───────────────────────────────────────────────────────
  const handleJoinMeeting = async (targetCode?: string) => {
    const rawCode = (targetCode || code).trim();
    if (!rawCode) {
      setError('Please enter a meeting code or link.');
      return;
    }
    if (!user) {
      setError('Please sign in to join a meeting.');
      return;
    }

    // Extract code even if user pasted a full URL or deep link (e.g. meethub://meeting/MH-XXXX-XXX or full invite text)
    const cleanCode = parseMeetingCode(rawCode);

    setError('');
    setBusy(true);
    triggerHaptic();

    try {
      const meeting = await getMeeting(cleanCode);
      if (!meeting) {
        throw new Error(`Meeting "${cleanCode}" was not found. Please verify the code.`);
      }
      if (meeting.status === 'ended') {
        throw new Error('This meeting has already ended.');
      }

      await joinMeeting(meeting.meetingId, user.uid);

      router.replace({
        pathname: '/meeting/[meetingId]',
        params: {
          meetingId: meeting.meetingId,
          camera: String(cameraOn),
          microphone: String(micOn),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join this meeting room.');
      setBusy(false);
    }
  };

  // ── Paste Code from Clipboard ──────────────────────────────────────────────────
  const handlePasteCode = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setCode(text.trim());
        setError('');
        triggerHaptic();
      }
    } catch {
      /* ignore */
    }
  };

  // ── Copy Generated Code ────────────────────────────────────────────────────────
  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(generatedCode);
      setCopied(true);
      triggerHaptic();
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  };

  // ── Copy Direct Connection Web Link ───────────────────────────────────────────
  const handleCopyLink = async () => {
    try {
      const link = getMeetingWebLink(generatedCode);
      await Clipboard.setStringAsync(link);
      setCopiedLink(true);
      triggerHaptic();
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      /* ignore */
    }
  };

  // ── Share Meeting Invitation ───────────────────────────────────────────────────
  const handleShareInvite = async () => {
    const meetingTitle = title.trim() || `${firstName}'s Meeting`;
    const invite = formatMeetingInvite({
      meetingId: generatedCode,
      title: meetingTitle,
      hostName: user?.displayName || firstName || 'MeetHub Host',
    });
    try {
      await Share.share({
        title: invite.title,
        message: invite.message,
        url: invite.url,
      });
    } catch {
      /* cancelled */
    }
  };

  const userInitial = (user?.displayName || user?.email || 'M').slice(0, 1).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.topCenter}>
            <Text style={[styles.screenTitle, { color: colors.text }]}>Meeting Room</Text>
            <Text style={[styles.screenSub, { color: colors.muted }]}>
              {mode === 'create' ? 'Set up & start instant room' : 'Enter code to join room'}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/schedule')}
            style={[styles.scheduleIconBtn, { backgroundColor: `${colors.primary}12` }]}
          >
            <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {/* Google Meet / Zoom Segmented Mode Switcher */}
        <View style={[styles.segmentContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={() => {
              setMode('create');
              setError('');
              triggerHaptic();
            }}
            style={[
              styles.segmentTab,
              mode === 'create' && [styles.segmentTabActive, { backgroundColor: colors.primary }],
            ]}
          >
            <MaterialCommunityIcons
              name="video-plus"
              size={18}
              color={mode === 'create' ? 'white' : colors.muted}
            />
            <Text
              style={[
                styles.segmentTabText,
                { color: mode === 'create' ? 'white' : colors.muted },
              ]}
            >
              New Meeting
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setMode('join');
              setError('');
              triggerHaptic();
            }}
            style={[
              styles.segmentTab,
              mode === 'join' && [styles.segmentTabActive, { backgroundColor: colors.primary }],
            ]}
          >
            <MaterialCommunityIcons
              name="login-variant"
              size={18}
              color={mode === 'join' ? 'white' : colors.muted}
            />
            <Text
              style={[
                styles.segmentTabText,
                { color: mode === 'join' ? 'white' : colors.muted },
              ]}
            >
              Join Room
            </Text>
          </Pressable>
        </View>

        {/* Error Alert Box */}
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: `${colors.danger}14`, borderColor: `${colors.danger}30` }]}>
            <MaterialCommunityIcons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {/* Google Meet / Jitsi style GREEN ROOM (Audio/Video Preview) */}
        <View style={[styles.previewCard, { backgroundColor: dark ? '#13151b' : '#1e293b' }]}>
          <View style={styles.previewHeader}>
            <View style={styles.liveIndicator}>
              <View style={[styles.liveDot, { backgroundColor: cameraOn ? '#22c55e' : '#ef4444' }]} />
              <Text style={styles.liveText}>{cameraOn ? 'Camera Ready' : 'Camera Off'}</Text>
            </View>
            <View style={styles.micIndicator}>
              <MaterialCommunityIcons
                name={micOn ? 'microphone' : 'microphone-off'}
                size={14}
                color={micOn ? '#22c55e' : '#ef4444'}
              />
              <Text style={styles.micIndicatorText}>{micOn ? 'Mic Unmuted' : 'Muted'}</Text>
            </View>
          </View>

          {/* Central Avatar / Video Display */}
          <View style={styles.previewCenter}>
            <View
              style={[
                styles.previewAvatar,
                {
                  backgroundColor: cameraOn ? '#2563eb' : '#334155',
                  borderColor: cameraOn ? '#60a5fa' : '#475569',
                },
              ]}
            >
              <Text style={styles.previewAvatarText}>{userInitial}</Text>
            </View>
            <Text style={styles.previewName}>{user?.displayName || 'You'}</Text>
            <Text style={styles.previewStatus}>
              {cameraOn
                ? micOn
                  ? 'Ready with video and audio'
                  : 'Video on • Mic muted'
                : micOn
                ? 'Camera off • Audio only'
                : 'Joining with mic & video off'}
            </Text>
          </View>

          {/* Floating Pre-meeting Controls */}
          <View style={styles.previewControls}>
            {/* Mic Toggle Button */}
            <Pressable
              onPress={() => {
                setMicOn((prev) => !prev);
                triggerHaptic();
              }}
              style={[
                styles.mediaBtn,
                {
                  backgroundColor: micOn ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  borderColor: micOn ? '#22c55e' : '#ef4444',
                },
              ]}
            >
              <MaterialCommunityIcons
                name={micOn ? 'microphone' : 'microphone-off'}
                size={22}
                color={micOn ? '#22c55e' : '#ef4444'}
              />
              <Text style={[styles.mediaBtnText, { color: micOn ? '#22c55e' : '#ef4444' }]}>
                {micOn ? 'Mic On' : 'Mic Off'}
              </Text>
            </Pressable>

            {/* Camera Toggle Button */}
            <Pressable
              onPress={() => {
                setCameraOn((prev) => !prev);
                triggerHaptic();
              }}
              style={[
                styles.mediaBtn,
                {
                  backgroundColor: cameraOn ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  borderColor: cameraOn ? '#3b82f6' : '#ef4444',
                },
              ]}
            >
              <MaterialCommunityIcons
                name={cameraOn ? 'video' : 'video-off'}
                size={22}
                color={cameraOn ? '#60a5fa' : '#ef4444'}
              />
              <Text style={[styles.mediaBtnText, { color: cameraOn ? '#60a5fa' : '#ef4444' }]}>
                {cameraOn ? 'Video On' : 'Video Off'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── MODE 1: CREATE MEETING ── */}
        {mode === 'create' ? (
          <View style={styles.formSection}>
            {/* Meeting Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.muted }]}>ROOM NAME</Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons name="format-title" size={20} color={colors.primary} />
                <TextInput
                  value={title}
                  onChangeText={(t) => {
                    setTitle(t);
                    setError('');
                  }}
                  placeholder="e.g. Design Review, Team Sync"
                  placeholderTextColor={colors.muted}
                  style={[styles.textInput, { color: colors.text }]}
                  maxLength={60}
                />
                {title.length > 0 && (
                  <Pressable onPress={() => setTitle('')} hitSlop={8}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={colors.muted} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Instant Meeting Code Preview Card */}
            <View
              style={[
                styles.codeCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.codeCardLeft}>
                <Text style={[styles.codeCardLabel, { color: colors.muted }]}>
                  PREVIEW ROOM CODE
                </Text>
                <Text style={[styles.codeCardCode, { color: colors.primary }]}>
                  {generatedCode}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => void handleCopyCode()}
                  style={[styles.copyBtn, { backgroundColor: `${colors.primary}15` }]}
                >
                  <MaterialCommunityIcons
                    name={copied ? 'check' : 'content-copy'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={[styles.copyBtnText, { color: colors.primary }]}>
                    {copied ? 'Code Copied' : 'Code'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void handleCopyLink()}
                  style={[styles.copyBtn, { backgroundColor: '#10b98118' }]}
                >
                  <MaterialCommunityIcons
                    name={copiedLink ? 'check' : 'link-variant'}
                    size={16}
                    color="#10B981"
                  />
                  <Text style={[styles.copyBtnText, { color: '#10B981' }]}>
                    {copiedLink ? 'Link Copied' : 'Link'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Start Meeting CTA */}
            <Pressable
              onPress={() => void handleStartMeeting()}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                busy && { opacity: 0.7 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <MaterialCommunityIcons name="video-plus" size={22} color="white" />
                  <Text style={styles.primaryBtnText}>Start Meeting Now</Text>
                </>
              )}
            </Pressable>

            {/* Share Invitation Option */}
            <Pressable
              onPress={() => void handleShareInvite()}
              style={[
                styles.secondaryBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MaterialCommunityIcons name="share-variant-outline" size={18} color={colors.text} />
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                Share Invite Link
              </Text>
            </Pressable>

            {/* Schedule Option */}
            <Pressable
              onPress={() => router.push('/schedule')}
              style={styles.tertiaryLink}
            >
              <MaterialCommunityIcons name="calendar-clock" size={16} color={colors.primary} />
              <Text style={[styles.tertiaryLinkText, { color: colors.primary }]}>
                Want to schedule this meeting for later?
              </Text>
            </Pressable>
          </View>
        ) : (
          /* ── MODE 2: JOIN MEETING ── */
          <View style={styles.formSection}>
            {/* Code Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.muted }]}>
                ENTER MEETING CODE OR LINK
              </Text>
              <View
                style={[
                  styles.codeInputWrapper,
                  {
                    backgroundColor: colors.surface,
                    borderColor: error ? colors.danger : colors.border,
                  },
                ]}
              >
                <TextInput
                  value={code}
                  onChangeText={(t) => {
                    setCode(t.toUpperCase());
                    setError('');
                  }}
                  placeholder="MH-XXXX-XXX"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="join"
                  onSubmitEditing={() => void handleJoinMeeting()}
                  style={[styles.codeInput, { color: colors.primary }]}
                />
                {code.length > 0 ? (
                  <Pressable onPress={() => setCode('')} hitSlop={8}>
                    <MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => void handlePasteCode()}
                    style={[styles.pasteBtn, { backgroundColor: `${colors.primary}15` }]}
                  >
                    <MaterialCommunityIcons name="clipboard-outline" size={16} color={colors.primary} />
                    <Text style={[styles.pasteBtnText, { color: colors.primary }]}>Paste</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Join CTA */}
            <Pressable
              onPress={() => void handleJoinMeeting()}
              disabled={busy || !code.trim()}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor:
                    !code.trim() || busy ? `${colors.primary}50` : colors.primary,
                },
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <MaterialCommunityIcons name="login-variant" size={22} color="white" />
                  <Text style={styles.primaryBtnText}>Join Meeting Room</Text>
                </>
              )}
            </Pressable>

            {/* Recent / Active Meeting Chips */}
            {recentMeetings.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={[styles.recentSectionLabel, { color: colors.muted }]}>
                  RECENT & ACTIVE ROOMS
                </Text>
                <View style={styles.recentChips}>
                  {recentMeetings.map((m) => (
                    <Pressable
                      key={m.meetingId}
                      onPress={() => {
                        setCode(m.meetingId);
                        void handleJoinMeeting(m.meetingId);
                      }}
                      style={[
                        styles.recentChip,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <View style={styles.recentChipIcon}>
                        <MaterialCommunityIcons name="video-outline" size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.recentChipTitle, { color: colors.text }]} numberOfLines={1}>
                          {m.title}
                        </Text>
                        <Text style={[styles.recentChipCode, { color: colors.muted }]}>
                          {m.meetingId}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={16} color={colors.muted} />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <Text style={[styles.joinHint, { color: colors.muted }]}>
              Tip: You can paste a full meeting invite link or just enter the code (e.g. MH-8K4P-29Q).
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  topCenter: {
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  screenSub: {
    fontSize: 12,
    marginTop: 2,
  },
  scheduleIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Segment Switcher */
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentTabText: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* Error Box */
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },

  /* Green Room Preview Card */
  previewCard: {
    borderRadius: 24,
    padding: 20,
    minHeight: 220,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  micIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  micIndicatorText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  previewCenter: {
    alignItems: 'center',
    marginVertical: 12,
  },
  previewAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 8,
  },
  previewAvatarText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
  },
  previewName: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  previewStatus: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  previewControls: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  mediaBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Form Section */
  formSection: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },

  /* Code Card */
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  codeCardLeft: {
    gap: 2,
  },
  codeCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  codeCardCode: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* CTA Buttons */
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
    borderRadius: 18,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tertiaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  tertiaryLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Join Code Input */
  codeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  codeInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pasteBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Recent meetings chips */
  recentSection: {
    marginTop: 6,
    gap: 8,
  },
  recentSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  recentChips: {
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  recentChipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentChipTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  recentChipCode: {
    fontSize: 12,
    marginTop: 1,
  },
  joinHint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
});
