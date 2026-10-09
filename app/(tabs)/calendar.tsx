import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MeetingCard } from '../../src/components/MeetingCard';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { subscribeToMyMeetings } from '../../src/services/meetingService';
import type { Meeting } from '../../src/types';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => new Date().toDateString());

  useEffect(() => {
    if (!user) return;
    return subscribeToMyMeetings(user.uid, setMeetings, (reason) => console.error('Calendar subscription failed', reason));
  }, [user]);

  const cells = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(firstDay).fill(0), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [month]);
  const meetingsByDate = useMemo(() => new Set(meetings.filter((item) => item.status !== 'ended').map((item) => new Date(item.scheduledDate).toDateString())), [meetings]);
  const selectedMeetings = meetings.filter((item) => new Date(item.scheduledDate).toDateString() === selected && item.status !== 'ended').sort((a, b) => a.startTime - b.startTime);

  const moveMonth = (step: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + step, 1));
  return (
    <Screen>
      <View style={styles.heading}><View><Text style={[styles.title, { color: colors.text }]}>Calendar</Text><Text style={[styles.subtitle, { color: colors.muted }]}>See what's coming up.</Text></View><Pressable style={[styles.add, { backgroundColor: colors.primary }]} onPress={() => router.push('/schedule')}><MaterialCommunityIcons name="plus" size={22} color="white" /></Pressable></View>
      <View style={[styles.calendar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.monthHead}><Pressable onPress={() => moveMonth(-1)}><MaterialCommunityIcons name="chevron-left" size={27} color={colors.text} /></Pressable><Text style={[styles.monthText, { color: colors.text }]}>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</Text><Pressable onPress={() => moveMonth(1)}><MaterialCommunityIcons name="chevron-right" size={27} color={colors.text} /></Pressable></View>
        <View style={styles.grid}>{WEEKDAYS.map((day, index) => <Text key={`${day}-${index}`} style={[styles.weekday, { color: colors.muted }]}>{day}</Text>)}</View>
        <View style={styles.grid}>{cells.map((day, index) => {
          if (day === 0) return <View key={`blank-${index}`} style={styles.dayCell} />;
          const date = new Date(month.getFullYear(), month.getMonth(), day);
          const hasMeeting = meetingsByDate.has(date.toDateString());
          const active = selected === date.toDateString();
          return <Pressable key={day} onPress={() => setSelected(date.toDateString())} style={[styles.dayCell, active && { backgroundColor: colors.primary }]}><Text style={[styles.dayText, { color: active ? 'white' : colors.text }]}>{day}</Text>{hasMeeting && <View style={[styles.dot, { backgroundColor: active ? 'white' : colors.primary }]} />}</Pressable>;
        })}</View>
      </View>
      <Text style={[styles.section, { color: colors.text }]}>{new Date(selected).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      {selectedMeetings.length ? selectedMeetings.map((meeting) => <MeetingCard key={meeting.meetingId} meeting={meeting} onPress={() => router.push({ pathname: '/meeting/[meetingId]', params: { meetingId: meeting.meetingId } })} />) : <Text style={[styles.empty, { color: colors.muted }]}>No meetings scheduled for this day.</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 5 },
  add: { width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  calendar: { borderWidth: 1, borderRadius: 22, padding: 16 },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthText: { fontSize: 16, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700', paddingVertical: 8 },
  dayCell: { width: `${100 / 7}%`, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, marginVertical: 2 },
  dayText: { fontSize: 13, fontWeight: '600' },
  dot: { width: 4, height: 4, borderRadius: 3, position: 'absolute', bottom: 5 },
  section: { fontSize: 17, fontWeight: '800', marginTop: 23, marginBottom: 13 },
  empty: { textAlign: 'center', padding: 22, fontSize: 13 },
});
