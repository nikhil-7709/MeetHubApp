import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RTCView, type MediaStream } from 'react-native-webrtc';
import { Button } from '../../src/components/Button';
import { ErrorMessage, LoadingSpinner } from '../../src/components/Feedback';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { endMeeting, getMeeting, joinMeeting } from '../../src/services/meetingService';
import { joinWebRtcRoom, type WebRtcRoom } from '../../src/services/webrtcService';
import type { Meeting, RoomParticipant } from '../../src/types';

function Control({
  icon,
  label,
  active,
  destructive,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  active?: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.control}>
      <View style={[styles.controlCircle, { backgroundColor: destructive ? colors.danger : active ? colors.primary : '#343A4B' }]}>
        <MaterialCommunityIcons name={icon} size={21} color="white" />
      </View>
      <Text numberOfLines={1} style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

export default function MeetingRoomScreen() {
  const { meetingId, camera, microphone } = useLocalSearchParams<{ meetingId: string; camera?: string; microphone?: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [muted, setMuted] = useState(microphone === 'false');
  const [cameraOff, setCameraOff] = useState(camera === 'false');
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [showParticipants, setShowParticipants] = useState(false);
  const roomRef = useRef<WebRtcRoom | null>(null);
  const elapsed = useMemo(() => `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`, [duration]);

  useEffect(() => {
    if (!user || !meetingId) return;
    let mounted = true;
    const startedAt = Date.now();
    const timer = setInterval(() => setDuration(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    void (async () => {
      try {
        const found = await getMeeting(meetingId);
        if (!found) throw new Error('This meeting could not be found.');
        if (found.status === 'ended') throw new Error('This meeting has ended.');
        await joinMeeting(found.meetingId, user.uid);
        const room = await joinWebRtcRoom(
          found.meetingId,
          {
            userId: user.uid,
            name: user.displayName || user.email || 'MeetHub member',
            profileImage: user.photoURL || '',
            isMuted: microphone === 'false',
            isCameraOff: camera === 'false',
          },
          {
            onRemoteStream: (id, stream) => setRemoteStreams((current) => ({ ...current, [id]: stream })),
            onParticipantChange: setParticipants,
            onConnectionChange: (_id, state) => {
              if (state === 'failed') setError('A participant connection failed. Check network access or configure TURN servers.');
            },
            onError: (reason) => setError(reason.message),
          },
        );
        if (!mounted) {
          await room.leave();
          return;
        }
        roomRef.current = room;
        room.toggleMicrophone(microphone !== 'false');
        room.toggleCamera(camera !== 'false');
        setMuted(microphone === 'false');
        setCameraOff(camera === 'false');
        setLocalStream(room.localStream);
        setMeeting(found);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Unable to connect to this meeting.';
        setError(/permission|denied|camera|microphone/i.test(message)
          ? `Camera and microphone access is required to join. Enable the permissions in Android Settings. (${message})`
          : message);
      } finally {
        if (mounted) setBusy(false);
      }
    })();
    return () => {
      mounted = false;
      clearInterval(timer);
      const room = roomRef.current;
      roomRef.current = null;
      if (room) void room.leave().catch((reason: unknown) => console.error('WebRTC cleanup failed', reason));
    };
  }, [camera, meetingId, microphone, user]);

  const toggleMic = () => {
    const next = !muted;
    roomRef.current?.toggleMicrophone(!next);
    setMuted(next);
  };
  const toggleCamera = () => {
    const next = !cameraOff;
    roomRef.current?.toggleCamera(!next);
    setCameraOff(next);
  };

  const exit = async () => {
    if (!user || !meeting) return;
    setBusy(true);
    try {
      if (meeting.hostId === user.uid) await endMeeting(meeting.meetingId);
      await roomRef.current?.leave();
      roomRef.current = null;
      router.replace('/(tabs)');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to leave the meeting cleanly.');
      setBusy(false);
    }
  };

  const confirmExit = () => Alert.alert(
    meeting?.hostId === user?.uid ? 'End meeting?' : 'Leave meeting?',
    meeting?.hostId === user?.uid ? 'This will end the meeting for all participants.' : 'You can rejoin while the meeting is still active.',
    [
      { text: 'Stay', style: 'cancel' },
      { text: meeting?.hostId === user?.uid ? 'End meeting' : 'Leave', style: 'destructive', onPress: () => { void exit(); } },
    ],
  );

  const toggleScreenShare = async () => {
    try {
      const isSharing = await roomRef.current?.toggleScreenShare();
      if (isSharing !== undefined) setSharing(isSharing);
    } catch (reason) {
      setError(reason instanceof Error ? `Screen share failed: ${reason.message}` : 'Screen sharing is not available on this device.');
    }
  };

  if (busy && !localStream) return <View style={[styles.loader, { backgroundColor: '#151925' }]}><LoadingSpinner label="Connecting to your meeting…" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View><Text style={styles.brand}>MeetHub</Text><Text style={styles.meetingCode}>{meeting?.meetingId ?? meetingId}</Text></View>
        <View style={styles.headerRight}><View style={styles.live}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View><Text style={styles.duration}>{elapsed}</Text></View>
      </View>
      {error ? <View style={styles.errorWrap}><ErrorMessage message={error} /></View> : null}
      <View style={styles.videoArea}>
        <View style={[styles.videoTile, styles.localTile]}>
          {localStream && !cameraOff
            ? <RTCView streamURL={localStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" mirror />
            : <View style={styles.cameraOff}><View style={styles.bigAvatar}><Text style={styles.avatarInitial}>{(user?.displayName || user?.email || 'M').slice(0, 1).toUpperCase()}</Text></View><Text style={styles.participantName}>{user?.displayName || 'You'}</Text><Text style={styles.videoOff}>Camera off</Text></View>}
          <View style={styles.nameTag}><Text style={styles.nameTagText}>{user?.displayName || 'You'}{muted ? '  ·  muted' : ''}</Text></View>
        </View>
        <ScrollView horizontal style={styles.remoteRow} contentContainerStyle={styles.remoteContent}>
          {participants.filter((item) => item.userId !== user?.uid).map((item) => {
            const stream = remoteStreams[item.userId];
            return <View key={item.userId} style={styles.remoteTile}>
              {stream && !item.isCameraOff ? <RTCView streamURL={stream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" /> : <View style={styles.remotePlaceholder}><View style={styles.smallAvatar}><Text style={styles.avatarInitial}>{item.name.slice(0, 1).toUpperCase()}</Text></View><Text style={styles.videoOff}>{item.isCameraOff ? 'Camera off' : 'Connecting…'}</Text></View>}
              <View style={styles.nameTag}><Text numberOfLines={1} style={styles.nameTagText}>{item.name}{item.isMuted ? '  ·  muted' : ''}</Text></View>
            </View>;
          })}
          {participants.length <= 1 && <View style={styles.waiting}><MaterialCommunityIcons name="account-multiple-outline" size={22} color="#BBC2D2" /><Text style={styles.waitingText}>Waiting for others to join</Text></View>}
        </ScrollView>
      </View>
      {showParticipants && <ScrollView style={styles.participantList}>
        <Text style={styles.panelTitle}>Participants · {participants.length}</Text>
        {participants.map((item) => <View key={item.userId} style={styles.personRow}><View style={styles.smallAvatar}><Text style={styles.avatarInitial}>{item.name.slice(0, 1).toUpperCase()}</Text></View><Text numberOfLines={1} style={styles.personName}>{item.name}{item.userId === meeting?.hostId ? '  ·  Host' : ''}</Text><MaterialCommunityIcons name={item.isMuted ? 'microphone-off' : 'microphone'} color="white" size={18} /></View>)}
      </ScrollView>}
      <View style={styles.controls}>
        <Control icon={muted ? 'microphone-off' : 'microphone'} label={muted ? 'Unmute' : 'Mute'} active={!muted} onPress={toggleMic} />
        <Control icon={cameraOff ? 'video-off' : 'video'} label={cameraOff ? 'Camera on' : 'Camera off'} active={!cameraOff} onPress={toggleCamera} />
        <Control icon="camera-flip-outline" label="Flip" onPress={() => roomRef.current?.switchCamera()} />
        <Control icon={sharing ? 'monitor-share' : 'monitor-share'} label={sharing ? 'Stop share' : 'Share'} active={sharing} onPress={() => void toggleScreenShare()} />
        <Control icon="chat-outline" label="Chat" onPress={() => router.push({ pathname: '/meeting/[meetingId]/chat', params: { meetingId: meetingId ?? '' } })} />
        <Control icon="account-group-outline" label="People" active={showParticipants} onPress={() => setShowParticipants((value) => !value)} />
        <Control icon="phone-hangup" label="Leave" destructive onPress={confirmExit} />
      </View>
      <Pressable onPress={() => void Clipboard.setStringAsync(String(meeting?.meetingId ?? meetingId)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not copy code.'))} style={styles.copyCode}><MaterialCommunityIcons name="content-copy" size={14} color="#C2C8D5" /><Text style={styles.copyText}>Copy meeting code</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#151925', paddingTop: 20, paddingHorizontal: 15 },
  loader: { flex: 1, justifyContent: 'center' },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 18, fontWeight: '800', color: 'white' },
  meetingCode: { fontSize: 11, color: '#AAB2C3', marginTop: 3, letterSpacing: 0.8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, padding: 7, backgroundColor: '#E4546425' },
  liveDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#F06574' },
  liveText: { color: '#F3838D', fontSize: 9, fontWeight: '800' },
  duration: { color: 'white', fontVariant: ['tabular-nums'], fontSize: 13, fontWeight: '700' },
  errorWrap: { marginTop: 4, marginBottom: 8 },
  videoArea: { flex: 1, minHeight: 260, paddingVertical: 7 },
  videoTile: { backgroundColor: '#222838', borderRadius: 23, overflow: 'hidden' },
  localTile: { flex: 1, minHeight: 200, position: 'relative' },
  cameraOff: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  bigAvatar: { width: 74, height: 74, borderRadius: 28, backgroundColor: '#5746E8', alignItems: 'center', justifyContent: 'center' },
  smallAvatar: { width: 42, height: 42, borderRadius: 17, backgroundColor: '#5746E8', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: 'white', fontSize: 19, fontWeight: '800' },
  participantName: { fontSize: 14, color: 'white', fontWeight: '700' },
  videoOff: { color: '#BBC2D2', fontSize: 11 },
  nameTag: { position: 'absolute', bottom: 10, left: 10, backgroundColor: '#111521CC', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '85%' },
  nameTagText: { color: 'white', fontSize: 11, fontWeight: '600' },
  remoteRow: { maxHeight: 134, flexGrow: 0, marginTop: 9 },
  remoteContent: { gap: 9, paddingBottom: 2 },
  remoteTile: { width: 132, height: 122, position: 'relative', borderRadius: 17, overflow: 'hidden', backgroundColor: '#222838' },
  remotePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', minWidth: 190 },
  waitingText: { color: '#BBC2D2', fontSize: 12 },
  participantList: { maxHeight: 180, borderRadius: 17, backgroundColor: '#222838', padding: 13 },
  panelTitle: { color: 'white', fontSize: 14, fontWeight: '700', marginBottom: 9 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  personName: { flex: 1, color: 'white', fontSize: 13 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly', paddingTop: 10, gap: 5 },
  control: { minWidth: '22%', alignItems: 'center', gap: 6, paddingVertical: 6 },
  controlCircle: { width: 49, height: 49, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  controlText: { color: '#DDE1EA', fontSize: 10, fontWeight: '600' },
  copyCode: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  copyText: { color: '#C2C8D5', fontSize: 11 },
});
