import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorMessage, LoadingSpinner } from '../../src/components/Feedback';
import { MeetingCard } from '../../src/components/MeetingCard';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import {
  createMeeting,
  getMeeting,
  joinMeeting,
  subscribeToMyMeetings,
} from '../../src/services/meetingServiceUnified';
import type { Meeting } from '../../src/types';
import { formatMeetingInvite, parseMeetingCode } from '../../src/utils/meetingLink';

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Inline Quick Join Bar state
  const [quickCode, setQuickCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [startingInstant, setStartingInstant] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToMyMeetings(
      user.uid,
      (items) => {
        setMeetings(items);
        setLoading(false);
        setError('');
      },
      (reason) => {
        setError(reason.message);
        setLoading(false);
      },
    );
  }, [user]);

  const upcoming = useMemo(
    () =>
      meetings
        .filter((meeting) => meeting.status !== 'ended' && meeting.endTime >= Date.now())
        .sort((a, b) => a.startTime - b.startTime)
        .slice(0, 4),
    [meetings],
  );

  const rawName = user?.displayName?.trim() || '';
  const isGuestPlaceholder = /^guest/i.test(rawName);
  const resolvedDisplayName =
    isGuestPlaceholder && user?.email?.toLowerCase() === 'vipnikhilpatil7709@gmail.com'
      ? 'Nikhil Patil'
      : rawName || (user?.email ? user.email.split('@')[0] : 'there');
  const firstName = resolvedDisplayName.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const todayDateString = new Date().toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const triggerHaptic = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* ignore */
    }
  };

  // ── 1-Tap Instant Meeting Start ──────────────────────────────────────────────
  const handleStartInstant = async () => {
    if (!user) return;
    triggerHaptic();
    setStartingInstant(true);
    try {
      const now = Date.now();
      const newMeeting = await createMeeting(
        {
          title: `${firstName}'s Meeting`,
          description: 'Instant meeting room',
          hostId: user.uid,
          hostName: user.displayName || user.email || 'Host',
          scheduledDate: now,
          startTime: now,
          endTime: now + 2 * 60 * 60 * 1000,
        },
        'active',
      );
      router.push({
        pathname: '/meeting/[meetingId]',
        params: { meetingId: newMeeting.meetingId, camera: 'true', microphone: 'true' },
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not create meeting room.');
    } finally {
      setStartingInstant(false);
    }
  };

  // ── 1-Tap Quick Code Join ────────────────────────────────────────────────────
  const handleQuickJoin = async () => {
    const raw = parseMeetingCode(quickCode);
    if (!raw) return;
    if (!user) return;
    triggerHaptic();
    setJoining(true);
    try {
      const meeting = await getMeeting(raw);
      if (!meeting) {
        Alert.alert(
          'Room Not Found',
          `No meeting found with code "${raw}". Check the code or link and try again.`,
        );
        return;
      }
      if (meeting.status === 'ended') {
        Alert.alert('Meeting Ended', 'This meeting has already ended.');
        return;
      }
      await joinMeeting(meeting.meetingId, user.uid);
      setQuickCode('');
      router.push({
        pathname: '/meeting/[meetingId]',
        params: { meetingId: meeting.meetingId, camera: 'true', microphone: 'true' },
      });
    } catch (err) {
      Alert.alert('Join Error', err instanceof Error ? err.message : 'Unable to join meeting.');
    } finally {
      setJoining(false);
    }
  };

  // ── Share Personal Meeting Invite ────────────────────────────────────────────
  const handleSharePersonalLink = async () => {
    triggerHaptic();
    const activeMeeting = meetings.find((m) => m.status === 'active') || meetings[0];
    const meetingCode = activeMeeting?.meetingId || `MH-USER-${(user?.uid || '101').slice(0, 4).toUpperCase()}`;
    const invite = formatMeetingInvite({
      meetingId: meetingCode,
      title: activeMeeting?.title || `${user?.displayName || 'Host'}'s Personal Room`,
      hostName: user?.displayName || 'MeetHub Host',
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: dark ? '#0A0F1D' : '#F8FAFC' }}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 110 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ═══ TOP HEADER ═══════════════════════════════════════════════════════ */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.dateChip}>
            <View style={styles.datePulseDot} />
            <Text style={[styles.dateChipText, { color: dark ? '#94A3B8' : '#64748B' }]}>
              {todayDateString} · Ready
            </Text>
          </View>
          <Text style={[styles.greeting, { color: colors.muted }]}>{greeting},</Text>
          <Text style={[styles.userName, { color: colors.text }]}>
            {firstName} <Text style={{ color: '#4F46E5' }}>✦</Text>
          </Text>
        </View>

        <View style={styles.topBarRight}>
          <View style={styles.brandLogoHeaderBox}>
            <Image
              source={require('../../assets/images/meethub-logo.png')}
              style={styles.brandLogoHeaderImg}
              resizeMode="cover"
            />
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={({ pressed }) => [
              styles.avatarBtn,
              {
                backgroundColor: dark ? '#1E293B' : '#EFF6FF',
                borderColor: dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(37, 99, 235, 0.2)',
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {firstName.slice(0, 1).toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ═══ 4 ACTION GRID (Zoom / FaceTime style) ═════════════════════════════ */}
      <View style={styles.actionGrid}>
        {/* 1. New Meeting */}
        <Pressable
          onPress={() => {
            triggerHaptic();
            router.push('/create-meeting');
          }}
          style={({ pressed }) => [
            styles.actionCard,
            {
              backgroundColor: dark ? '#131927' : '#FFFFFF',
              borderColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              shadowColor: '#EA580C',
            },
            pressed && styles.actionCardPressed,
          ]}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#FFEDD5' }]}>
            <MaterialCommunityIcons name="video-plus" size={26} color="#EA580C" />
          </View>
          <Text style={[styles.actionCardTitle, { color: colors.text }]}>New Meeting</Text>
          <Text style={[styles.actionCardSub, { color: colors.muted }]}>Instant room</Text>
        </Pressable>

        {/* 2. Join Room */}
        <Pressable
          onPress={() => {
            triggerHaptic();
            router.push('/join-meeting');
          }}
          style={({ pressed }) => [
            styles.actionCard,
            {
              backgroundColor: dark ? '#131927' : '#FFFFFF',
              borderColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              shadowColor: '#0284C7',
            },
            pressed && styles.actionCardPressed,
          ]}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#E0F2FE' }]}>
            <MaterialCommunityIcons name="login-variant" size={26} color="#0284C7" />
          </View>
          <Text style={[styles.actionCardTitle, { color: colors.text }]}>Join Room</Text>
          <Text style={[styles.actionCardSub, { color: colors.muted }]}>With code</Text>
        </Pressable>

        {/* 3. Schedule */}
        <Pressable
          onPress={() => {
            triggerHaptic();
            router.push('/schedule');
          }}
          style={({ pressed }) => [
            styles.actionCard,
            {
              backgroundColor: dark ? '#131927' : '#FFFFFF',
              borderColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              shadowColor: '#9333EA',
            },
            pressed && styles.actionCardPressed,
          ]}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#F3E8FF' }]}>
            <MaterialCommunityIcons name="calendar-clock" size={26} color="#9333EA" />
          </View>
          <Text style={[styles.actionCardTitle, { color: colors.text }]}>Schedule</Text>
          <Text style={[styles.actionCardSub, { color: colors.muted }]}>Plan ahead</Text>
        </Pressable>

        {/* 4. Share Link */}
        <Pressable
          onPress={() => void handleSharePersonalLink()}
          style={({ pressed }) => [
            styles.actionCard,
            {
              backgroundColor: dark ? '#131927' : '#FFFFFF',
              borderColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              shadowColor: '#16A34A',
            },
            pressed && styles.actionCardPressed,
          ]}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#DCFCE7' }]}>
            <MaterialCommunityIcons name="share-variant-outline" size={26} color="#16A34A" />
          </View>
          <Text style={[styles.actionCardTitle, { color: colors.text }]}>Share Link</Text>
          <Text style={[styles.actionCardSub, { color: colors.muted }]}>Invite team</Text>
        </Pressable>
      </View>

      {/* ═══ GOOGLE MEET QUICK JOIN BAR ═══════════════════════════════════════ */}
      <View
        style={[
          styles.quickJoinBar,
          {
            backgroundColor: dark ? '#131927' : '#FFFFFF',
            borderColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            shadowColor: dark ? '#000' : '#64748B',
          },
        ]}
      >
        <MaterialCommunityIcons name="keyboard-outline" size={20} color={colors.primary} />
        <TextInput
          value={quickCode}
          onChangeText={(t) => setQuickCode(t.toUpperCase())}
          placeholder="Enter a code or link..."
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="join"
          onSubmitEditing={() => void handleQuickJoin()}
          style={[styles.quickJoinInput, { color: colors.text }]}
        />
        {quickCode.length > 0 && (
          <Pressable onPress={() => setQuickCode('')} hitSlop={8} style={{ marginRight: 6 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
        <Pressable
          onPress={() => void handleQuickJoin()}
          disabled={joining || !quickCode.trim()}
          style={({ pressed }) => [
            styles.quickJoinBtn,
            {
              backgroundColor:
                !quickCode.trim() || joining ? `${colors.primary}40` : colors.primary,
            },
            pressed && { opacity: 0.9 },
          ]}
        >
          {joining ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.quickJoinBtnText}>Join</Text>
          )}
        </Pressable>
      </View>

      {/* ═══ LUXURY HERO INSTANT CARD ═════════════════════════════════════════ */}
      <View style={styles.heroCard}>
        <View style={styles.heroDecorCircle} />
        <View style={styles.heroDecorCircleTwo} />

        <View style={styles.heroContent}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="flash" size={13} color="#FDE047" />
              <Text style={styles.heroBadgeText}>HD VIDEO & AUDIO</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Instant Meeting Room</Text>
          <Text style={styles.heroDesc}>
            Launch a video room with micro-camera, crystal mic, live chat & screen sharing right now.
          </Text>

          <Pressable
            onPress={() => void handleStartInstant()}
            disabled={startingInstant}
            style={({ pressed }) => [
              styles.heroCTA,
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
            ]}
          >
            {startingInstant ? (
              <ActivityIndicator color="#4F46E5" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="play" size={18} color="#4F46E5" />
                <Text style={styles.heroCTAText}>Start Now</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* ═══ UPCOMING MEETINGS SECTION ════════════════════════════════════════ */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Meetings</Text>
          {upcoming.length > 0 && (
            <View style={styles.sectionCountPill}>
              <Text style={styles.sectionCountText}>{upcoming.length}</Text>
            </View>
          )}
        </View>
        <Pressable onPress={() => router.push('/(tabs)/meetings')} hitSlop={10}>
          <Text style={styles.seeAllLink}>See all</Text>
        </Pressable>
      </View>

      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <LoadingSpinner label="Loading your schedule…" />
      ) : upcoming.length ? (
        <View style={styles.meetingsList}>
          {upcoming.map((meeting) => (
            <MeetingCard
              key={meeting.meetingId}
              meeting={meeting}
              onPress={() =>
                router.push({
                  pathname: '/meeting/[meetingId]',
                  params: { meetingId: meeting.meetingId },
                })
              }
            />
          ))}
        </View>
      ) : !error ? (
        <EmptyState
          title="Your calendar is open"
          description="Create or schedule a meeting to see it here."
        />
      ) : null}

      {/* ═══ QUICK STATS PILL ═════════════════════════════════════════════════ */}
      <View
        style={[
          styles.statCard,
          {
            backgroundColor: dark ? '#131927' : '#FFFFFF',
            borderColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          },
        ]}
      >
        <View style={styles.statIconWrap}>
          <MaterialCommunityIcons name="video-check-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statTitle, { color: colors.text }]}>
            <Text style={{ fontWeight: '800' }}>{meetings.length}</Text> meeting
            {meetings.length === 1 ? '' : 's'} recorded
          </Text>
          <Text style={[styles.statSubtitle, { color: colors.muted }]}>
            WebRTC signaling server connected
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  topBarLeft: {
    gap: 3,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  datePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogoHeaderBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  brandLogoHeaderImg: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },

  // 4 Action Grid
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  actionCardPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  actionCardSub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },

  // Google Meet Quick Join Bar
  quickJoinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 18,
    gap: 10,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickJoinInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 6,
  },
  quickJoinBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickJoinBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
  },

  // Luxury Hero Card
  heroCard: {
    backgroundColor: '#4F46E5',
    borderRadius: 26,
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  heroDecorCircle: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroDecorCircleTwo: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  heroContent: {
    padding: 22,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroDesc: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 19,
  },
  heroCTA: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  heroCTAText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '800',
  },

  // Upcoming Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionCountPill: {
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionCountText: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '800',
  },
  seeAllLink: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '700',
  },
  meetingsList: {
    gap: 2,
  },

  // Stats Card
  statCard: {
    borderWidth: 1,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginTop: 18,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  statSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
