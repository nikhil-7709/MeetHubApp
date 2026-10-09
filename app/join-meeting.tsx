import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { ErrorMessage } from '../src/components/Feedback';
import { Input } from '../src/components/Input';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';
import { getMeeting, joinMeeting } from '../src/services/meetingService';

export default function JoinMeetingScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [code, setCode] = useState('');
  const [camera, setCamera] = useState(true);
  const [microphone, setMicrophone] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const enter = async () => {
    if (!user) return;
    setError('');
    setBusy(true);
    try {
      const meeting = await getMeeting(code);
      if (!meeting) throw new Error('Meeting not found. Check the code and try again.');
      if (meeting.status === 'ended') throw new Error('This meeting has ended.');
      await joinMeeting(meeting.meetingId, user.uid);
      router.replace({ pathname: '/meeting/[meetingId]', params: { meetingId: meeting.meetingId, camera: String(camera), microphone: String(microphone) } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to join this meeting.');
    } finally {
      setBusy(false);
    }
  };

  const Toggle = ({ label, icon, on, toggle }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; on: boolean; toggle: () => void }) => (
    <Pressable onPress={toggle} style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <MaterialCommunityIcons name={icon} size={20} color={on ? colors.primary : colors.muted} />
      <Text style={[styles.toggleText, { color: colors.text }]}>{label}</Text>
      <View style={[styles.switch, { backgroundColor: on ? colors.primary : colors.border }]}><View style={[styles.knob, { alignSelf: on ? 'flex-end' : 'flex-start' }]} /></View>
    </Pressable>
  );

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text }]}>Join a meeting</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>Enter the meeting code you received from your host.</Text>
      {error ? <ErrorMessage message={error} /> : null}
      <Input label="Meeting code" value={code} onChangeText={(value) => setCode(value.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="MH-8K4P-29Q" />
      <Text style={[styles.section, { color: colors.text }]}>Before you join</Text>
      <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="account-voice" size={36} color={colors.primary} />
        <Text style={[styles.previewTitle, { color: colors.text }]}>You're in control</Text>
        <Text style={[styles.subtitle, { color: colors.muted, textAlign: 'center' }]}>Choose your audio and video settings before entering the room.</Text>
      </View>
      <Toggle label="Camera" icon="video-outline" on={camera} toggle={() => setCamera((value) => !value)} />
      <Toggle label="Microphone" icon="microphone-outline" on={microphone} toggle={() => setMicrophone((value) => !value)} />
      <Button title="Join meeting" onPress={enter} loading={busy} disabled={!code.trim()} style={{ marginTop: 13 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  section: { fontSize: 16, fontWeight: '700', marginVertical: 8 },
  preview: { minHeight: 176, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', padding: 20, marginBottom: 13, gap: 7 },
  previewTitle: { fontSize: 16, fontWeight: '700' },
  toggle: { borderWidth: 1, borderRadius: 15, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 },
  toggleText: { flex: 1, fontSize: 14, fontWeight: '600' },
  switch: { width: 44, height: 26, borderRadius: 20, justifyContent: 'center', padding: 3 },
  knob: { width: 20, height: 20, borderRadius: 12, backgroundColor: 'white' },
});
