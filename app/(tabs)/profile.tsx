import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { ErrorMessage } from '../../src/components/Feedback';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { logout, updateDisplayName } from '../../src/services/authService';
import { registerDeviceForPush } from '../../src/services/notifications';

export default function ProfileScreen() {
  const { user } = useAuth();
  const { dark, colors, toggle } = useAppTheme();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const saveName = async () => {
    if (!user || name.trim().length < 2) return setError('Name must contain at least 2 characters.');
    setBusy(true);
    setError('');
    try {
      await updateDisplayName(user, name);
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update your profile.');
    } finally {
      setBusy(false);
    }
  };

  const setting = (icon: keyof typeof MaterialCommunityIcons.glyphMap, label: string, action: () => void, trailing?: React.ReactNode) => (
    <Pressable onPress={action} style={[styles.setting, { borderBottomColor: colors.border }]}><View style={[styles.settingIcon, { backgroundColor: `${colors.primary}12` }]}><MaterialCommunityIcons name={icon} size={20} color={colors.primary} /></View><Text style={[styles.settingText, { color: colors.text }]}>{label}</Text>{trailing ?? <MaterialCommunityIcons name="chevron-right" size={21} color={colors.muted} />}</Pressable>
  );

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>Your MeetHub account and preferences.</Text>
      <View style={[styles.profile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {user?.photoURL ? <Image source={{ uri: user.photoURL }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: `${colors.primary}19` }]}><Text style={[styles.initial, { color: colors.primary }]}>{(user?.displayName ?? user?.email ?? 'M').slice(0, 1).toUpperCase()}</Text></View>}
        <Text style={[styles.name, { color: colors.text }]}>{user?.displayName ?? 'MeetHub member'}</Text>
        <Text style={[styles.email, { color: colors.muted }]}>{user?.email}</Text>
      </View>
      {error ? <ErrorMessage message={error} /> : null}
      {editing ? <View style={styles.edit}><Input label="Display name" value={name} onChangeText={setName} autoComplete="name" /><Button title="Save changes" onPress={() => void saveName()} loading={busy} /><Button title="Cancel" variant="outline" onPress={() => setEditing(false)} /></View> : setting('account-edit-outline', 'Edit profile', () => { setName(user?.displayName ?? ''); setEditing(true); })}
      {setting('bell-outline', 'Enable push notifications', () => { if (!user) return; void registerDeviceForPush(user.uid).then(() => Alert.alert('Notifications enabled', 'This device is registered for meeting alerts.')).catch((reason: unknown) => { setError(reason instanceof Error ? reason.message : 'Could not enable notifications.'); }); })}
      {setting('cog-outline', 'Notification preferences', () => { void Linking.openSettings().catch(() => Alert.alert('Settings unavailable', 'Open your device settings to manage notifications.')); })}
      {setting('shield-lock-outline', 'Privacy', () => Alert.alert('Privacy & security', 'MeetHub uses Firebase Authentication and access-controlled Firestore rules. Meeting media is peer-to-peer and not recorded by this app.'))}
      {setting('theme-light-dark', 'Dark mode', toggle, <Switch value={dark} onValueChange={toggle} trackColor={{ true: colors.primary }} />)}
      {setting('information-outline', 'About MeetHub', () => Alert.alert('MeetHub', 'A clearer space for better meetings.'))}
      <Button title="Sign out" variant="danger" onPress={() => void logout().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Sign-out failed.'))} style={styles.logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 5, marginBottom: 19 },
  profile: { borderWidth: 1, borderRadius: 22, alignItems: 'center', padding: 22, marginBottom: 19 },
  avatar: { width: 76, height: 76, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  initial: { fontSize: 28, fontWeight: '800' },
  name: { fontSize: 17, fontWeight: '800' },
  email: { fontSize: 13, marginTop: 4 },
  setting: { minHeight: 65, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 13 },
  settingIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  settingText: { flex: 1, fontSize: 14, fontWeight: '600' },
  edit: { marginVertical: 13 },
  logout: { marginTop: 22 },
});
