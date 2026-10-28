import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorMessage, LoadingSpinner } from '../../src/components/Feedback';
import { MeetingCard } from '../../src/components/MeetingCard';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { subscribeToMyMeetings } from '../../src/services/meetingServiceUnified';
import type { Meeting } from '../../src/types';

type Filter = 'Upcoming' | 'Past';

export default function MeetingsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  
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
    <ScrollView 
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>Meetings</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Your schedule, all in one place.</Text>
        </View>
        <Pressable 
          onPress={() => router.push('/schedule')} 
          style={({ pressed }) => [
            styles.add, 
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }
          ]}
        >
          <MaterialCommunityIcons name="plus" size={24} color="white" />
        </Pressable>
      </View>
      
      <View style={[styles.filters, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(['Upcoming', 'Past'] as const).map((item) => (
          <Pressable 
            key={item} 
            onPress={() => setFilter(item)} 
            style={[
              styles.filter, 
              filter === item && { backgroundColor: colors.primary, shadowColor: colors.primary }
            ]}
          >
            <Text style={{ 
              color: filter === item ? 'white' : colors.muted, 
              fontSize: 14, 
              fontWeight: filter === item ? '800' : '600' 
            }}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
      
      {error ? <ErrorMessage message={error} /> : null}
      
      {loading ? (
        <View style={{ marginTop: 40 }}><LoadingSpinner label="Loading meetings…" /></View>
      ) : filtered.length ? (
        <View style={styles.list}>
          {filtered.map((meeting) => (
            <MeetingCard 
              key={meeting.meetingId} 
              meeting={meeting} 
              onPress={meeting.status !== 'ended' ? () => router.push({ pathname: '/meeting/[meetingId]', params: { meetingId: meeting.meetingId } }) : undefined} 
            />
          ))}
        </View>
      ) : !error ? (
        <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}12` }]}>
            <MaterialCommunityIcons name="calendar-blank" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {filter === 'Past' ? 'No past meetings' : 'No upcoming meetings'}
          </Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {filter === 'Past' ? 'Completed meetings will appear here.' : 'Create one or join with a code.'}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerText: { flex: 1 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 4, lineHeight: 22 },
  add: { 
    width: 52, 
    height: 52, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  filters: { 
    padding: 6, 
    borderRadius: 20, 
    flexDirection: 'row', 
    marginBottom: 24,
    borderWidth: 1,
  },
  filter: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  list: { gap: 12 },
  emptyContainer: { 
    marginTop: 20, 
    borderWidth: 1, 
    borderRadius: 28, 
    padding: 32, 
    alignItems: 'center',
    borderStyle: 'dashed'
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 22 },
});
