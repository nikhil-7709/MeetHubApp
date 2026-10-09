import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';
import { Button } from '../../src/components/Button';
import { ErrorMessage } from '../../src/components/Feedback';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { loginWithEmail, loginWithGoogleIdToken, sendPasswordReset } from '../../src/services/authService';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';

export default function LoginScreen() {
  const { configured } = useAuth();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    responseType: ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
  });
  const googleConfigured = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  );

  useEffect(() => {
    const token = response?.type === 'success' ? response.params.id_token : undefined;
    if (!token) return;
    setBusy(true);
    loginWithGoogleIdToken(token)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Google sign-in failed.'))
      .finally(() => setBusy(false));
  }, [response]);

  const login = async () => {
    setError('');
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      await loginWithEmail(email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) return setError('Enter your email first so we can send a reset link.');
    setBusy(true);
    setError('');
    try {
      await sendPasswordReset(email);
      Alert.alert('Check your inbox', 'A password reset link has been sent if the account exists.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send the reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.brand}><View style={[styles.logo, { backgroundColor: colors.primary }]}><MaterialCommunityIcons name="video-outline" size={26} color="white" /></View><Text style={[styles.brandName, { color: colors.text }]}>Meet<Text style={{ color: colors.primary }}>Hub</Text></Text></View>
        <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Sign in to meet, share and get things done.</Text>
        {!configured && <ErrorMessage message="Firebase isn't configured yet. Copy .env.example to .env and add your Firebase project values before signing in." />}
        {error ? <ErrorMessage message={error} /> : null}
        <Input label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="Your password" />
        <Pressable onPress={forgotPassword} style={styles.forgot}><Text style={{ color: colors.primary, fontWeight: '700' }}>Forgot password?</Text></Pressable>
        <Button title="Sign in" onPress={login} loading={busy} disabled={!configured} />
        <View style={styles.divider}><View style={[styles.line, { backgroundColor: colors.border }]} /><Text style={{ color: colors.muted, fontSize: 12 }}>OR CONTINUE WITH</Text><View style={[styles.line, { backgroundColor: colors.border }]} /></View>
        <Button title="Google" variant="outline" disabled={!configured || !googleConfigured || !request || busy} onPress={() => { void promptAsync().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Google sign-in could not be opened.')); }} />
        {!googleConfigured && <Text style={[styles.googleHint, { color: colors.muted }]}>Configure Google OAuth client IDs to enable Google sign-in.</Text>}
        <Text style={[styles.signup, { color: colors.muted }]}>New to MeetHub? <Link href="/(auth)/register" style={{ color: colors.primary, fontWeight: '700' }}>Create account</Link></Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 14, paddingVertical: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 16 },
  logo: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 24, fontWeight: '800' },
  title: { fontSize: 29, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: 14, lineHeight: 21, marginBottom: 11 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 4 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 11, marginVertical: 5 },
  line: { height: 1, flex: 1 },
  signup: { textAlign: 'center', marginTop: 8, fontSize: 14 },
  googleHint: { fontSize: 12, textAlign: 'center' },
});
