import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ErrorMessage } from '../components/Feedback';
import { Input } from '../components/Input';
import { Screen } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { createMeeting } from '../services/meetingService';
import { scheduleMeetingReminder } from '../services/notifications';
import type { Meeting } from '../types';

const roundToNextHalfHour = (date: Date) => {
  const value = new Date(date);
  value.setSeconds(0, 0);
  value.setMinutes(value.getMinutes() < 30 ? 30 : 0);
  if (value.getMinutes() === 0) value.setHours(value.getHours() + 1);
  return value;
};

function showTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function MeetingFormScreen({ startNow }: { startNow: boolean }) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(roundToNextHalfHour(new Date(Date.now() + 60_000)));
  const [endTime, setEndTime] = useState(new Date(startTime.getTime() + 60 * 60 * 1000));
  const [picker, setPicker] = useState<'date' | 'start' | 'end' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Meeting | null>(null);

  const onPickerChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setPicker(null);
    if (!selected) return;
    if (picker === 'date') {
      setDate(selected);
      setStartTime((current) => {
        const next = new Date(selected);
        next.setHours(current.getHours(), current.getMinutes(), 0, 0);
        return next;
      });
      setEndTime((current) => {
        const next = new Date(selected);
        next.setHours(current.getHours(), current.getMinutes(), 0, 0);
        return next;
      });
    } else if (picker === 'start') {
      setStartTime(selected);
      if (selected >= endTime) setEndTime(new Date(selected.getTime() + 60 * 60 * 1000));
    } else {
      setEndTime(selected);
    }
  };

  const save = async () => {
    setError('');
    if (!user) return setError('Sign in before creating a meeting.');
    if (title.trim().length < 2) return setError('Enter a meeting title (at least 2 characters).');
    const actualStart = startNow ? Date.now() : startTime.getTime();
    const actualEnd = startNow ? actualStart + 60 * 60 * 1000 : endTime.getTime();
    const selectedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    if (!startNow && selectedDay < todayStart) {
      return setError('Choose today or a future date.');
    }
    if (!startNow && actualEnd <= actualStart) return setError('End time must be after start time.');

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
        router.replace({ pathname: '/meeting/[meetingId]', params: { meetingId: meeting.meetingId } });
        return;
      }
      setSaved(meeting);
      try {
        await scheduleMeetingReminder(user.uid, meeting.meetingId, meeting.title, meeting.startTime);
      } catch (notificationError) {
        Alert.alert(
          'Meeting scheduled',
          notificationError instanceof Error
            ? `The meeting was saved, but its reminder could not be set: ${notificationError.message}`
            : 'The meeting was saved, but its reminder could not be set.',
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save this meeting.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!saved) return;
    try {
      await Share.share({ message: `Join "${saved.title}" on MeetHub. Meeting code: ${saved.meetingId}` });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not share the meeting invitation.');
    }
  };

  if (saved) {
    return (
      <Screen contentStyle={styles.successScreen}>
        <View style={[styles.successIcon, { backgroundColor: `${colors.success}18` }]}><Text style={{ color: colors.success, fontSize: 30 }}>✓</Text></View>
        <Text style={[styles.heading, { color: colors.text }]}>You&apos;re all set</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Your meeting has been added to your schedule.</Text>
        <View style={[styles.codeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.muted }]}>MEETING CODE</Text>
          <Text selectable style={[styles.code, { color: colors.primary }]}>{saved.meetingId}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{saved.title}</Text>
        </View>
        <Button title="Share invitation" onPress={() => void share()} />
        <Button title="Back to home" variant="outline" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  const dateLabel = date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const dateTimeRow = (label: string, value: string, onPress: () => void) => (
    <View style={styles.timeRow}><Text style={[styles.label, { color: colors.text }]}>{label}</Text><Button title={value} variant="outline" onPress={onPress} style={styles.timeButton} /></View>
  );

  return (
    <Screen>
      <Text style={[styles.heading, { color: colors.text }]}>{startNow ? 'Create a meeting' : 'Schedule a meeting'}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{startNow ? 'Set up your room, then invite your team.' : 'Find a time that works for everyone.'}</Text>
      {error ? <ErrorMessage message={error} /> : null}
      <Input label="Meeting title" value={title} onChangeText={setTitle} placeholder="Weekly team sync" maxLength={80} />
      <Input label="Description (optional)" value={description} onChangeText={setDescription} placeholder="What would you like to discuss?" multiline style={styles.description} maxLength={500} />
      {!startNow && <>
        {dateTimeRow('Date', dateLabel, () => setPicker('date'))}
        {dateTimeRow('Start time', showTime(startTime), () => setPicker('start'))}
        {dateTimeRow('End time', showTime(endTime), () => setPicker('end'))}
      </>}
      {picker && <DateTimePicker value={picker === 'date' ? date : picker === 'start' ? startTime : endTime} mode={picker === 'date' ? 'date' : 'time'} minimumDate={picker === 'date' ? new Date() : undefined} onChange={onPickerChange} />}
      <View style={{ flex: 1, minHeight: 26 }} />
      <Button title={startNow ? 'Start meeting' : 'Save meeting'} onPress={() => void save()} loading={busy} />
      {!startNow && <Text style={[styles.note, { color: colors.muted }]}>A reminder is scheduled 15 minutes before the meeting. Notifications require an Android development build.</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 27, fontWeight: '800', marginBottom: 7 },
  subtitle: { fontSize: 14, lineHeight: 21, marginBottom: 22 },
  description: { minHeight: 100, textAlignVertical: 'top', paddingTop: 14 },
  timeRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#9AA2B244' },
  label: { fontSize: 13, fontWeight: '700' },
  timeButton: { minHeight: 42, borderRadius: 12 },
  note: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  successScreen: { justifyContent: 'center' },
  successIcon: { width: 66, height: 66, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  codeCard: { borderWidth: 1, borderRadius: 22, padding: 23, alignItems: 'center', marginVertical: 22 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 2, marginVertical: 13 },
});
