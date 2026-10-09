import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Meeting } from '../types';
import { useAppTheme } from '../context/ThemeContext';

export function MeetingCard({ meeting, onPress }: { meeting: Meeting; onPress?: () => void }) {
  const { colors } = useAppTheme();
  const time = new Date(meeting.startTime).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const duration = meeting.durationSeconds === undefined
    ? null
    : `${Math.floor(meeting.durationSeconds / 60)} min`;
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: `${colors.primary}14` }]}><MaterialCommunityIcons name="video-outline" size={22} color={colors.primary} /></View>
      <View style={styles.info}><Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{meeting.title}</Text><Text style={[styles.meta, { color: colors.muted }]}>{time}{duration ? ` · ${duration}` : ''}</Text><Text style={[styles.code, { color: colors.primary }]}>{meeting.meetingId}</Text></View>
      <View style={[styles.pill, { backgroundColor: meeting.status === 'active' ? `${colors.success}18` : `${colors.primary}12` }]}><Text style={[styles.pillText, { color: meeting.status === 'active' ? colors.success : colors.primary }]}>{meeting.status}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 11 },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12 },
  code: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  pill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
});
