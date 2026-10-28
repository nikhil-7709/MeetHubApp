import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { createMeeting } from '../services/meetingServiceUnified';
import type { Meeting } from '../types';
import { formatMeetingInvite } from '../utils/meetingLink';

// ── helpers ───────────────────────────────────────────────────────────────────
function roundUp(date: Date, step = 30): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const rounded = Math.ceil(d.getMinutes() / step) * step;
  d.setMinutes(rounded >= 60 ? 0 : rounded);
  if (rounded >= 60) d.setHours(d.getHours() + 1);
  return d;
}
const fmt12 = (h: number, m: number) => {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_OF_WEEK = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── success view ──────────────────────────────────────────────────────────────
function SuccessView({ meeting, onShare, onHome, onJoin, colors }: {
  meeting: Meeting;
  onShare: () => void;
  onHome: () => void;
  onJoin: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <View style={[styles.successWrap, { backgroundColor: colors.background }]}>
      <View style={[styles.successIcon, { backgroundColor: `${colors.success}18` }]}>
        <MaterialCommunityIcons name="check-circle-outline" size={48} color={colors.success} />
      </View>
      <Text style={[styles.successTitle, { color: colors.text }]}>Meeting created! 🎉</Text>
      <Text style={[styles.successSub, { color: colors.muted }]}>
        Share the code below so your team can join.
      </Text>

      <View style={[styles.codeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.codeLabel, { color: colors.muted }]}>MEETING CODE</Text>
        <Text selectable style={[styles.codeValue, { color: colors.primary }]}>{meeting.meetingId}</Text>
        <Text style={[styles.codeTitle, { color: colors.text }]}>{meeting.title}</Text>
        <Text style={[styles.codeTime, { color: colors.muted }]}>
          {new Date(meeting.startTime).toLocaleString([], {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit',
          })}
        </Text>
      </View>

      <Pressable onPress={onShare} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
        <MaterialCommunityIcons name="share-variant-outline" size={18} color="white" />
        <Text style={styles.actionBtnText}>Share invitation</Text>
      </Pressable>

      <Pressable
        onPress={onJoin}
        style={[styles.actionBtn, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30`, borderWidth: 1 }]}
      >
        <MaterialCommunityIcons name="video-outline" size={18} color={colors.primary} />
        <Text style={[styles.actionBtnText, { color: colors.primary }]}>Join meeting now</Text>
      </Pressable>

      <Pressable onPress={onHome} style={styles.backLink}>
        <Text style={[styles.backLinkText, { color: colors.muted }]}>← Back to home</Text>
      </Pressable>
    </View>
  );
}

// ── inline date-time picker modal (works in Expo Go / any env) ────────────────
type PickMode = 'date' | 'start' | 'end';

function DateTimePickerModal({
  visible,
  mode,
  date,
  startTime,
  endTime,
  onClose,
  onConfirm,
  colors,
}: {
  visible: boolean;
  mode: PickMode;
  date: Date;
  startTime: Date;
  endTime: Date;
  onClose: () => void;
  onConfirm: (mode: PickMode, value: Date) => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const now = new Date();

  // Build day options (today + next 29 days)
  const dayOptions = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Hour options 0-23
  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Minute options 0, 15, 30, 45
  const minutes = [0, 15, 30, 45];

  const currentDate = mode === 'date' ? date : mode === 'start' ? startTime : endTime;

  const [selDay, setSelDay] = useState(() =>
    dayOptions.findIndex((d) => d.toDateString() === (mode === 'date' ? date : mode === 'start' ? startTime : endTime).toDateString()) || 0
  );
  const [selHour, setSelHour] = useState(currentDate.getHours());
  const [selMin, setSelMin] = useState(
    minutes.reduce((closest, m) => Math.abs(m - currentDate.getMinutes()) < Math.abs(closest - currentDate.getMinutes()) ? m : closest, 0)
  );

  const handleConfirm = () => {
    if (mode === 'date') {
      const result = new Date(dayOptions[selDay]);
      onConfirm(mode, result);
    } else {
      const base = dayOptions[selDay] ?? new Date(currentDate);
      base.setHours(0, 0, 0, 0);
      const result = new Date(base);
      result.setHours(selHour, selMin, 0, 0);
      onConfirm(mode, result);
    }
  };

  const title = mode === 'date' ? 'Select Date' : mode === 'start' ? 'Select Start Time' : 'Select End Time';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBg} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {/* Day selector (always shown) */}
          <Text style={[styles.pickerSectionLabel, { color: colors.muted }]}>DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
              {dayOptions.map((d, i) => {
                const sel = selDay === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setSelDay(i)}
                    style={[
                      styles.dayChip,
                      { borderColor: colors.border, backgroundColor: sel ? colors.primary : colors.background },
                    ]}
                  >
                    <Text style={[styles.dayChipWeekday, { color: sel ? 'white' : colors.muted }]}>
                      {DAYS_OF_WEEK[d.getDay()]}
                    </Text>
                    <Text style={[styles.dayChipDay, { color: sel ? 'white' : colors.text }]}>
                      {d.getDate()}
                    </Text>
                    <Text style={[styles.dayChipMonth, { color: sel ? 'rgba(255,255,255,0.75)' : colors.muted }]}>
                      {MONTHS[d.getMonth()]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Hour + Minute selector (for time modes) */}
          {mode !== 'date' && (
            <>
              <Text style={[styles.pickerSectionLabel, { color: colors.muted }]}>TIME</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                {/* Hours */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerColLabel, { color: colors.muted }]}>Hour</Text>
                  <ScrollView style={[styles.pickerScroll, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    {hours.map((h) => (
                      <Pressable
                        key={h}
                        onPress={() => setSelHour(h)}
                        style={[
                          styles.pickerItem,
                          selHour === h && { backgroundColor: colors.primary, borderRadius: 10 },
                        ]}
                      >
                        <Text style={[styles.pickerItemText, { color: selHour === h ? 'white' : colors.text }]}>
                          {fmt12(h, 0).split(':')[0]} {h < 12 ? 'AM' : 'PM'}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Minutes */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerColLabel, { color: colors.muted }]}>Minute</Text>
                  <View style={[styles.pickerScroll, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    {minutes.map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => setSelMin(m)}
                        style={[
                          styles.pickerItem,
                          selMin === m && { backgroundColor: colors.primary, borderRadius: 10 },
                        ]}
                      >
                        <Text style={[styles.pickerItemText, { color: selMin === m ? 'white' : colors.text }]}>
                          :{String(m).padStart(2, '0')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {/* Preview */}
              <View style={[styles.previewRow, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}25` }]}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary} />
                <Text style={[styles.previewText, { color: colors.primary }]}>
                  {DAYS_OF_WEEK[dayOptions[selDay]?.getDay() ?? 0]},{' '}
                  {MONTHS[dayOptions[selDay]?.getMonth() ?? 0]} {dayOptions[selDay]?.getDate()}{' '}
                  · {fmt12(selHour, selMin)}
                </Text>
              </View>
            </>
          )}

          {/* Confirm */}
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.confirmBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="check" size={20} color="white" />
            <Text style={styles.confirmBtnText}>Confirm</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── main form ─────────────────────────────────────────────────────────────────
export function MeetingFormScreen({ startNow }: { startNow: boolean }) {
  const { user, demoMode } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(roundUp(new Date(Date.now() + 60_000)));
  const [endTime, setEndTime] = useState(new Date(roundUp(new Date(Date.now() + 60_000)).getTime() + 60 * 60 * 1000));

  const [picker, setPicker] = useState<PickMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Meeting | null>(null);

  const handlePickerConfirm = (mode: PickMode, value: Date) => {
    setPicker(null);
    if (mode === 'date') {
      setDate(value);
      // Preserve hour/minute of startTime on the new date
      const newStart = new Date(value);
      newStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      setStartTime(newStart);
      const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
      setEndTime(newEnd);
    } else if (mode === 'start') {
      setStartTime(value);
      if (value >= endTime) {
        setEndTime(new Date(value.getTime() + 60 * 60 * 1000));
      }
    } else {
      if (value <= startTime) {
        setError('End time must be after start time.');
      } else {
        setEndTime(value);
        setError('');
      }
    }
  };

  const save = async () => {
    setError('');
    if (!user) return setError('You must be signed in to create a meeting.');
    if (title.trim().length < 2) return setError('Enter a meeting title (at least 2 characters).');

    const actualStart = startNow ? Date.now() : startTime.getTime();
    const actualEnd = startNow ? actualStart + 60 * 60 * 1000 : endTime.getTime();

    if (!startNow) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (date < todayStart) return setError('Choose today or a future date.');
      if (actualEnd <= actualStart) return setError('End time must be after start time.');
    }

    setBusy(true);
    try {
      const meeting = await createMeeting(
        {
          title: title.trim(),
          description: description.trim(),
          hostId: user.uid,
          hostName: user.displayName || user.email || 'MeetHub host',
          scheduledDate: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
          startTime: actualStart,
          endTime: actualEnd,
        },
        startNow ? 'active' : 'scheduled',
      );

      if (startNow) {
        router.replace({
          pathname: '/meeting/[meetingId]',
          params: { meetingId: meeting.meetingId },
        });
        return;
      }
      setSaved(meeting);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save this meeting.');
    } finally {
      setBusy(false);
    }
  };

  const shareMeeting = async () => {
    if (!saved) return;
    const invite = formatMeetingInvite({
      meetingId: saved.meetingId,
      title: saved.title,
      hostName: saved.hostName,
    });
    try {
      await Share.share({
        title: invite.title,
        message: invite.message,
        url: invite.url,
      });
    } catch { /* dismissed */ }
  };

  if (saved) {
    return (
      <SuccessView
        meeting={saved}
        colors={colors}
        onShare={() => void shareMeeting()}
        onJoin={() =>
          router.replace({
            pathname: '/meeting/[meetingId]',
            params: { meetingId: saved.meetingId },
          })
        }
        onHome={() => router.replace('/(tabs)')}
      />
    );
  }

  const durationMin = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
  const fmtDate = (d: Date) =>
    `${DAYS_OF_WEEK[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 36 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heading, { color: colors.text }]}>
              {startNow ? 'New meeting' : 'Schedule meeting'}
            </Text>
            <Text style={[styles.subheading, { color: colors.muted }]}>
              {startNow
                ? 'Your room is ready instantly — invite your team.'
                : 'Plan ahead and share the code with your team.'}
            </Text>
          </View>
        </View>

        {/* Demo badge */}
        {demoMode && (
          <View style={[styles.demoBadge, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}25` }]}>
            <MaterialCommunityIcons name="information-outline" size={14} color={colors.primary} />
            <Text style={[styles.demoBadgeText, { color: colors.primary }]}>
              Demo mode — meeting saved locally on this device
            </Text>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: `${colors.danger}12`, borderColor: `${colors.danger}25` }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {/* Title */}
        <Text style={[styles.fieldLabel, { color: colors.text }]}>Meeting title *</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Weekly team sync"
          placeholderTextColor={colors.muted}
          maxLength={80}
          style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        />

        {/* Description */}
        <Text style={[styles.fieldLabel, { color: colors.text }]}>Description (optional)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What will you discuss?"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={500}
          style={[styles.textInput, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        />

        {/* Date / time (scheduled only) */}
        {!startNow && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>DATE & TIME</Text>

            {/* Date row */}
            <Pressable
              onPress={() => setPicker('date')}
              style={[styles.pickerRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.pickerIconBox, { backgroundColor: `${colors.primary}14` }]}>
                <MaterialCommunityIcons name="calendar-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.pickerLabel, { color: colors.muted }]}>Date</Text>
              <Text style={[styles.pickerValue, { color: colors.text }]}>{fmtDate(date)}</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} />
            </Pressable>

            {/* Start time row */}
            <Pressable
              onPress={() => setPicker('start')}
              style={[styles.pickerRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.pickerIconBox, { backgroundColor: `${colors.primary}14` }]}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.pickerLabel, { color: colors.muted }]}>Start time</Text>
              <Text style={[styles.pickerValue, { color: colors.text }]}>
                {fmt12(startTime.getHours(), startTime.getMinutes())}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} />
            </Pressable>

            {/* End time row */}
            <Pressable
              onPress={() => setPicker('end')}
              style={[styles.pickerRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.pickerIconBox, { backgroundColor: `${colors.primary}14` }]}>
                <MaterialCommunityIcons name="clock-end" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.pickerLabel, { color: colors.muted }]}>End time</Text>
              <Text style={[styles.pickerValue, { color: colors.text }]}>
                {fmt12(endTime.getHours(), endTime.getMinutes())}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} />
            </Pressable>

            {/* Duration */}
            <View style={[styles.durationRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="timer-outline" size={16} color={colors.primary} />
              <Text style={[styles.durationText, { color: colors.muted }]}>
                Duration:{' '}
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {durationMin >= 60
                    ? `${Math.floor(durationMin / 60)}h ${durationMin % 60 > 0 ? `${durationMin % 60}m` : ''}`.trim()
                    : `${durationMin} min`}
                </Text>
              </Text>
            </View>
          </>
        )}

        {/* Save / Start button */}
        <Pressable
          onPress={() => void save()}
          disabled={busy}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: busy ? `${colors.primary}80` : colors.primary },
            pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
          ]}
        >
          {busy ? (
            <Text style={styles.submitBtnText}>Saving…</Text>
          ) : (
            <>
              <MaterialCommunityIcons
                name={startNow ? 'video-plus-outline' : 'calendar-check-outline'}
                size={20}
                color="white"
              />
              <Text style={styles.submitBtnText}>
                {startNow ? 'Start meeting now' : 'Save meeting'}
              </Text>
            </>
          )}
        </Pressable>

        {!startNow && (
          <Text style={[styles.note, { color: colors.muted }]}>
            {demoMode
              ? 'Meeting saved locally — only visible on this device.'
              : 'A reminder notification will be sent 15 minutes before the meeting starts.'}
          </Text>
        )}
      </ScrollView>

      {/* Date/Time picker modal */}
      {picker && (
        <DateTimePickerModal
          visible={true}
          mode={picker}
          date={date}
          startTime={startTime}
          endTime={endTime}
          onClose={() => setPicker(null)}
          onConfirm={handlePickerConfirm}
          colors={colors}
        />
      )}
    </>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 22, gap: 4 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 18 },
  backBtn: { marginTop: 4 },
  heading: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subheading: { fontSize: 13, lineHeight: 19, marginTop: 4 },

  demoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10,
    borderRadius: 10, borderWidth: 1, marginBottom: 14,
  },
  demoBadgeText: { fontSize: 12, fontWeight: '600', flex: 1 },

  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12,
    borderRadius: 12, borderWidth: 1, marginBottom: 14,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },

  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  textInput: {
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14,
    fontSize: 15, minHeight: 52, marginBottom: 4,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 14 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginTop: 16 },

  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 16, borderWidth: 1, marginBottom: 10,
  },
  pickerIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickerLabel: { fontSize: 13, flex: 1 },
  pickerValue: { fontSize: 14, fontWeight: '700' },

  durationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
    borderRadius: 12, borderWidth: 1, marginBottom: 20,
  },
  durationText: { fontSize: 13 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 9, minHeight: 58, borderRadius: 18, marginTop: 8,
  },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },

  note: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12 },

  // Modal
  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, padding: 22, paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },

  pickerSectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },

  dayChip: {
    alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 16, borderWidth: 1, minWidth: 64,
  },
  dayChipWeekday: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dayChipDay: { fontSize: 20, fontWeight: '800', marginVertical: 2 },
  dayChipMonth: { fontSize: 10, fontWeight: '600' },

  pickerColLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textAlign: 'center' },
  pickerScroll: { borderWidth: 1, borderRadius: 14, maxHeight: 190 },
  pickerItem: { paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' },
  pickerItemText: { fontSize: 15, fontWeight: '600' },

  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16,
  },
  previewText: { fontSize: 13, fontWeight: '700' },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, minHeight: 54, borderRadius: 16,
  },
  confirmBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },

  // Success
  successWrap: { flex: 1, padding: 28, justifyContent: 'center', gap: 4 },
  successIcon: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  successTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  successSub: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 8 },
  codeCard: { borderWidth: 1, borderRadius: 22, padding: 22, alignItems: 'center', marginVertical: 18, gap: 6 },
  codeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  codeValue: { fontSize: 30, fontWeight: '800', letterSpacing: 3, marginVertical: 6 },
  codeTitle: { fontSize: 15, fontWeight: '700' },
  codeTime: { fontSize: 13 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 9, minHeight: 54, borderRadius: 16, marginTop: 10,
  },
  actionBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  backLink: { alignItems: 'center', marginTop: 16 },
  backLinkText: { fontSize: 14 },
});
