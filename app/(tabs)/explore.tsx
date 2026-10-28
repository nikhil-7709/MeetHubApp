import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../src/context/ThemeContext';

type TipItem = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  body: string;
  link?: string;
};

const TIPS: TipItem[] = [
  {
    icon: 'video-plus-outline',
    title: 'Start an instant meeting',
    body: 'Hit "+ New meeting" on the Home tab to create a room immediately and share the code with your team.',
  },
  {
    icon: 'calendar-plus-outline',
    title: 'Schedule ahead',
    body: 'Use the Schedule tab to plan meetings in advance. You can set date, start time, and end time — a local reminder fires 15 minutes before.',
  },
  {
    icon: 'login-variant',
    title: 'Join with a code',
    body: 'Got a meeting code like MH-XXXX-XXX? Tap "Join" on the home screen, enter the code, and jump straight in.',
  },
  {
    icon: 'theme-light-dark',
    title: 'Dark mode',
    body: 'Head to the Profile tab → toggle Dark mode to switch between light and dark themes. Your preference is saved locally.',
  },
  {
    icon: 'calendar-month-outline',
    title: 'Calendar view',
    body: 'The Calendar tab shows all your upcoming meetings plotted on a monthly calendar. Tap any day to see meetings scheduled on that date.',
  },
  {
    icon: 'shield-lock-outline',
    title: 'Your privacy',
    body: 'In demo mode, all data is stored on this device only — nothing leaves your phone. Connect Firebase for a full cloud-backed experience.',
  },
];

function TipCard({ item }: { item: TipItem }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={item.link ? () => void Linking.openURL(item.link!) : undefined}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.iconBox, { backgroundColor: `${colors.primary}14` }]}>
        <MaterialCommunityIcons name={item.icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.cardText, { color: colors.muted }]}>{item.body}</Text>
      </View>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <MaterialCommunityIcons name="compass-outline" size={32} color="white" style={{ marginBottom: 10 }} />
        <Text style={styles.heroTitle}>Explore MeetHub</Text>
        <Text style={styles.heroBody}>Tips, shortcuts, and features to get the most from your meetings.</Text>
      </View>

      {/* Quick actions */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick actions</Text>
      <View style={styles.quickRow}>
        {[
          { icon: 'video-plus-outline' as const, label: 'New meeting', onPress: () => router.push('/create-meeting') },
          { icon: 'calendar-plus-outline' as const, label: 'Schedule', onPress: () => router.push('/schedule') },
          { icon: 'login-variant' as const, label: 'Join', onPress: () => router.push('/join-meeting') },
        ].map((action) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            style={[styles.quickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.quickIcon, { backgroundColor: `${colors.primary}14` }]}>
              <MaterialCommunityIcons name={action.icon} size={20} color={colors.primary} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Tips */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Tips & features</Text>
      {TIPS.map((tip) => (
        <TipCard key={tip.title} item={tip} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22 },
  hero: { borderRadius: 24, padding: 24, marginBottom: 26 },
  heroTitle: { color: 'white', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  heroBody: { color: '#FFFFFFCC', fontSize: 14, lineHeight: 21 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
  quickRow: { flexDirection: 'row', gap: 12, marginBottom: 26 },
  quickBtn: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14, alignItems: 'center', gap: 8 },
  quickIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: 'row', gap: 14, marginBottom: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody: { flex: 1, gap: 5 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardText: { fontSize: 13, lineHeight: 19 },
});
