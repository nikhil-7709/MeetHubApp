import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorMessage, LoadingSpinner } from '../../src/components/Feedback';
import { MeetingCard } from '../../src/components/MeetingCard';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { subscribeToMyMeetings } from '../../src/services/meetingService';
import type { Meeting } from '../../src/types';

type Filter = 'Upcoming' | 'Past';

export default function MeetingsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('Upcoming');

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

  const filtered = useMemo(() => {
    return meetings.filter((meeting) => filter === 'Upcoming'
      ? meeting.status !== 'ended' && meeting.endTime >= Date.now()
      : meeting.status === 'ended' || meeting.endTime < Date.now())
      .sort((a, b) => filter === 'Upcoming' ? a.startTime - b.startTime : b.startTime - a.startTime);
  }, [filter, meetings]);

  return (
    <Screen>
      <View style={styles.header}><View><Text style={[styles.title, { color: colors.text }]}>Meetings</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Your team time, all in one place.</Text></View><Pressable onPress={() => router.push('/schedule')} style={[styles.add, { backgroundColor: colors.primary }]}><MaterialCommunityIcons name="plus" size={22} color="white" /></Pressable></View>
      <View style={[styles.filters, { backgroundColor: colors.surface }]}>{(['Upcoming', 'Past'] as const).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && { backgroundColor: colors.primary }]}><Text style={{ color: filter === item ? 'white' : colors.muted, fontSize: 13, fontWeight: '700' }}>{item}</Text></Pressable>)}</View>
      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingSpinner label="Loading meetings…" /> : filtered.length ? filtered.map((meeting) => <MeetingCard key={meeting.meetingId} meeting={meeting} onPress={meeting.status !== 'ended' ? () => router.push({ pathname: '/meeting/[meetingId]', params: { meetingId: meeting.meetingId } }) : undefined} />) : !error ? <View style={{ marginTop: 30 }}><Text style={[styles.emptyText, { color: colors.muted }]}>{filter === 'Past' ? 'Completed meetings will appear here.' : 'No upcoming meetings yet. Create one or join with a code.'}</Text></View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 19 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 5 },
  add: { width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  filters: { padding: 4, borderRadius: 15, flexDirection: 'row', marginBottom: 17 },
  filter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 12 },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 21, paddingHorizontal: 25 },
});
