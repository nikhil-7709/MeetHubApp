import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { EmptyState, ErrorMessage, LoadingSpinner } from '../../src/components/Feedback';
import { MeetingCard } from '../../src/components/MeetingCard';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { subscribeToMyMeetings } from '../../src/services/meetingService';
import type { Meeting } from '../../src/types';

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    return subscribeToMyMeetings(user.uid, (items) => {
      setMeetings(items);
      setLoading(false);
      setError('');
    }, (reason) => {
      setError(reason.message);
      setLoading(false);
    });
  }, [user]);

  const upcoming = useMemo(
    () => meetings.filter((meeting) => meeting.status !== 'ended' && meeting.startTime >= Date.now() - 60 * 60 * 1000).sort((a, b) => a.startTime - b.startTime).slice(0, 3),
    [meetings],
  );
  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen>
      <View style={styles.top}>
        <View><Text style={[styles.greeting, { color: colors.muted }]}>{greeting},</Text><Text style={[styles.name, { color: colors.text }]}>{firstName} <Text style={{ color: colors.primary }}>✦</Text></Text></View>
        <Pressable onPress={() => router.push('/(tabs)/profile')} style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}><Text style={[styles.avatarText, { color: colors.primary }]}>{firstName.slice(0, 1).toUpperCase()}</Text></Pressable>
      </View>
      <Text style={[styles.subheading, { color: colors.muted }]}>Make room for better conversations.</Text>

      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <View style={styles.heroIcon}><MaterialCommunityIcons name="video-plus-outline" size={24} color="white" /></View>
        <Text style={styles.heroTitle}>Ready to meet?</Text>
        <Text style={styles.heroText}>Start a room or jump into one with your team.</Text>
        <Button title="＋  New meeting" onPress={() => router.push('/create-meeting')} style={styles.heroButton} />
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => router.push('/join-meeting')} style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.actionIcon, { backgroundColor: `${colors.primary}14` }]}><MaterialCommunityIcons name="login-variant" size={21} color={colors.primary} /></View><Text style={[styles.actionTitle, { color: colors.text }]}>Join</Text><Text style={[styles.actionText, { color: colors.muted }]}>Enter a code</Text></Pressable>
        <Pressable onPress={() => router.push('/schedule')} style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.actionIcon, { backgroundColor: `${colors.success}18` }]}><MaterialCommunityIcons name="calendar-plus-outline" size={21} color={colors.success} /></View><Text style={[styles.actionTitle, { color: colors.text }]}>Schedule</Text><Text style={[styles.actionText, { color: colors.muted }]}>Plan ahead</Text></Pressable>
      </View>

      <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming meetings</Text><Link href="/(tabs)/meetings" style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>See all</Link></View>
      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingSpinner label="Loading your meetings…" /> : upcoming.length ? upcoming.map((meeting) => <MeetingCard key={meeting.meetingId} meeting={meeting} onPress={() => router.push({ pathname: '/meeting/[meetingId]', params: { meetingId: meeting.meetingId } })} />) : !error ? <EmptyState title="Your calendar is open" description="Create or schedule a meeting to see it here." /> : null}

      <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="video-check-outline" size={20} color={colors.primary} /><Text style={[styles.statText, { color: colors.text }]}>{meetings.length} meeting{meetings.length === 1 ? '' : 's'} in your history</Text></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 15, fontWeight: '500' },
  name: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  subheading: { fontSize: 14, marginTop: 5, marginBottom: 20 },
  avatar: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  hero: { padding: 20, borderRadius: 24, marginBottom: 14 },
  heroIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF25', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { color: 'white', fontSize: 21, fontWeight: '800' },
  heroText: { color: '#FFFFFFC9', fontSize: 13, marginTop: 6, marginBottom: 12 },
  heroButton: { backgroundColor: 'white', alignSelf: 'flex-start', minHeight: 44, borderRadius: 14 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 27 },
  action: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 14, gap: 5 },
  actionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  actionTitle: { fontSize: 15, fontWeight: '700' },
  actionText: { fontSize: 12 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  stat: { borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginTop: 7 },
  statText: { fontSize: 13, fontWeight: '600' },
});
