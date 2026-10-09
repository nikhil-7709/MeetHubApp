import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import { Button } from '../../src/components/Button';
import { ErrorMessage } from '../../src/components/Feedback';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { registerWithEmail } from '../../src/services/authService';

export default function RegisterScreen() {
  const { configured } = useAuth();
  const { colors } = useAppTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const register = async () => {
    setError('');
    if (name.trim().length < 2) return setError('Enter your name (at least 2 characters).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Your password must contain at least 6 characters.');
    if (password !== confirmPassword) return setError('The passwords do not match.');
    setBusy(true);
    try {
      await registerWithEmail(name, email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
        <Text style={[styles.title, { color: colors.text }]}>Create your account</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Start bringing your team together.</Text>
        {!configured && <ErrorMessage message="Add your Firebase project settings to .env before creating an account." />}
        {error ? <ErrorMessage message={error} /> : null}
        <Input label="Full name" value={name} onChangeText={setName} autoComplete="name" placeholder="Your name" />
        <Input label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="At least 6 characters" />
        <Input label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Enter password again" />
        <Button title="Create account" onPress={register} loading={busy} disabled={!configured} />
        <Text style={[styles.footer, { color: colors.muted }]}>Already have an account? <Link href="/(auth)/login" style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Link></Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { flex: 1, justifyContent: 'center', gap: 14, paddingVertical: 24 }, title: { fontSize: 27, fontWeight: '800' }, subtitle: { fontSize: 14, marginBottom: 8 }, footer: { textAlign: 'center', marginTop: 10, fontSize: 14 } });
