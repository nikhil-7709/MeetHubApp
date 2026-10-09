import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useAppTheme();
  return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={[styles.label, { color: colors.muted }]}>{label}</Text></View>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  const { colors } = useAppTheme();
  return <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialCommunityIcons name="calendar-blank-outline" size={28} color={colors.primary} /><Text style={[styles.title, { color: colors.text }]}>{title}</Text><Text style={[styles.label, { color: colors.muted }]}>{description}</Text></View>;
}

export function ErrorMessage({ message }: { message: string }) {
  const { colors } = useAppTheme();
  return <View style={[styles.error, { backgroundColor: `${colors.danger}14` }]}><MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={[styles.errorText, { color: colors.danger }]}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 14 },
  label: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  empty: { borderWidth: 1, borderRadius: 20, padding: 24, alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '700' },
  error: { padding: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
