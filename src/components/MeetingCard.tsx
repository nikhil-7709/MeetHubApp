import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import type { Meeting } from '../types';
import { useAppTheme } from '../context/ThemeContext';

export function MeetingCard({
  meeting,
  onPress,
}: {
  meeting: Meeting;
  onPress?: () => void;
}) {
  const { colors, dark } = useAppTheme();
  const [copied, setCopied] = useState(false);

  const isActive = meeting.status === 'active';
  const isEnded = meeting.status === 'ended';

  const startTimeDate = new Date(meeting.startTime);
  const isToday = new Date().toDateString() === startTimeDate.toDateString();

  const formattedDate = isToday
    ? 'Today'
    : startTimeDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

  const formattedTime = startTimeDate.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const duration =
    meeting.durationSeconds !== undefined
      ? `${Math.floor(meeting.durationSeconds / 60)} min`
      : null;

  const handleCopyCode = async (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Clipboard.setStringAsync(meeting.meetingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: dark ? '#131927' : '#FFFFFF',
          borderColor: isActive
            ? `${colors.primary}40`
            : dark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.06)',
          shadowColor: isActive ? colors.primary : dark ? '#000000' : '#64748B',
        },
        pressed && styles.cardPressed,
      ]}
    >
      {/* Left Icon Squircle */}
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: isActive
              ? dark
                ? 'rgba(16, 185, 129, 0.15)'
                : '#ECFDF5'
              : isEnded
              ? dark
                ? 'rgba(148, 163, 184, 0.12)'
                : '#F1F5F9'
              : dark
              ? 'rgba(37, 99, 235, 0.15)'
              : '#EFF6FF',
          },
        ]}
      >
        <MaterialCommunityIcons
          name={isActive ? 'video' : isEnded ? 'video-off-outline' : 'video-outline'}
          size={24}
          color={isActive ? '#10B981' : isEnded ? '#94A3B8' : colors.primary}
        />
        {isActive && <View style={styles.livePulseDot} />}
      </View>

      {/* Center Details */}
      <View style={styles.centerInfo}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: isEnded ? colors.muted : colors.text }]}
          >
            {meeting.title}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="clock-outline" size={13} color={colors.muted} />
          <Text style={[styles.metaTime, { color: colors.muted }]}>
            {formattedDate}, {formattedTime}
            {duration ? ` · ${duration}` : ''}
          </Text>
        </View>

        {/* Copyable Code Badge */}
        <Pressable onPress={handleCopyCode} style={styles.codeBadge} hitSlop={6}>
          <Text style={[styles.codeText, { color: colors.primary }]}>{meeting.meetingId}</Text>
          <MaterialCommunityIcons
            name={copied ? 'check' : 'content-copy'}
            size={12}
            color={copied ? '#10B981' : colors.muted}
          />
        </Pressable>
      </View>

      {/* Right Action / Status Pill */}
      <View style={styles.rightAction}>
        {isActive ? (
          <View style={styles.joinActionPill}>
            <Text style={styles.joinActionText}>Join</Text>
            <MaterialCommunityIcons name="arrow-right" size={14} color="white" />
          </View>
        ) : (
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isEnded
                  ? dark
                    ? 'rgba(148, 163, 184, 0.12)'
                    : '#F1F5F9'
                  : dark
                  ? 'rgba(37, 99, 235, 0.12)'
                  : '#EFF6FF',
              },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: isEnded ? colors.muted : colors.primary },
              ]}
            >
              {isEnded ? 'Ended' : 'Scheduled'}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  livePulseDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  centerInfo: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  rightAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  joinActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  joinActionText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
});
