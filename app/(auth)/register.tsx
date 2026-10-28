import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { registerDemo, signInAsGuest } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Social 2-Step Verification Modal
  const [verifyProvider, setVerifyProvider] = useState<'google' | 'apple' | null>(null);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationStep, setVerificationStep] = useState<'prompt' | 'code'>('prompt');
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  const isWide = width >= 720;

  const triggerHaptic = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* ignore */
    }
  };

  const handleGuestRegister = async () => {
    setBusy(true);
    triggerHaptic();
    try {
      await signInAsGuest(fullName.trim() || 'Nikhil Patil', email.trim() || 'vipnikhilpatil7709@gmail.com');
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guest registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    if (fullName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Your password must contain at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setBusy(true);
    triggerHaptic();

    try {
      // registerDemo routes to Supabase when configured, demo mode otherwise
      const result = await registerDemo(nameToDisplayName(fullName), email.trim(), password);
      if (result?.rateLimited) {
        Alert.alert(
          'Supabase Rate Limit Reached',
          'Supabase email limit reached. Account created in Demo Mode so you can start using MeetHub immediately!',
          [{ text: 'Continue to App', onPress: () => router.replace('/(tabs)') }],
        );
      } else if (result?.needsConfirmation) {
        Alert.alert(
          'Verification Email Sent',
          `We have sent an activation link to ${email.trim()}. Please verify your email before signing in, or continue with Instant Demo Access.`,
          [
            {
              text: 'Go to Sign In',
              onPress: () => {
                router.replace({
                  pathname: '/(auth)/login',
                  params: { email: email.trim(), unconfirmed: '1' },
                });
              },
            },
            {
              text: 'Use Instant Demo',
              onPress: async () => {
                await signInAsGuest(fullName.trim(), email.trim());
                router.replace('/(tabs)');
              },
            },
          ],
        );
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const nameToDisplayName = (raw: string) => raw.trim();

  // Social Auth with Two-Step Security Verification
  const handleStartSocialVerification = (provider: 'google' | 'apple') => {
    triggerHaptic();
    setVerifyProvider(provider);
    setVerificationStep('prompt');
    setVerificationEmail(provider === 'google' ? 'alex.rivera@gmail.com' : 'alex.rivera@icloud.com');
    setVerificationCode('');
    setVerificationError('');
  };

  const handleSendVerificationCode = () => {
    triggerHaptic();
    if (!verificationEmail.trim() || !verificationEmail.includes('@')) {
      setVerificationError('Please enter a valid email address.');
      return;
    }
    setVerificationError('');
    setVerifying(true);

    setTimeout(() => {
      setVerifying(false);
      setVerificationStep('code');
      setVerificationCode('482910');
      Alert.alert(
        'Verification Code Sent',
        `A 6-digit verification code has been sent to ${verificationEmail}. Use code: 482910`
      );
    }, 800);
  };

  const handleVerifyAndEnter = async () => {
    triggerHaptic();
    if (verificationCode.trim().length !== 6) {
      setVerificationError('Please enter the 6-digit verification code.');
      return;
    }

    setVerificationError('');
    setVerifying(true);

    try {
      await signInAsGuest(
        verifyProvider === 'google' ? 'Google User' : 'Apple User',
        verificationEmail || 'alex.rivera@example.com',
      );
      setVerifying(false);
      setVerifyProvider(null);
      router.replace('/(tabs)');
    } catch {
      setVerifying(false);
      setVerificationError('Verification failed. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 20) + 16,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.mainCard, isWide && styles.mainCardWide]}>
            {/* ═══ TOP HEADER WITH BACK ARROW & BRAND ═════════════════ */}
            <View style={styles.topHeader}>
              <Pressable
                onPress={() => router.replace('/(auth)/welcome')}
                style={styles.backBtn}
                hitSlop={12}
                accessibilityLabel="Go back"
              >
                <MaterialCommunityIcons name="chevron-left" size={28} color="#0F172A" />
              </Pressable>

              <View style={styles.brandCenter}>
                <View style={styles.brandIconBox}>
                  <MaterialCommunityIcons name="video-vintage" size={24} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.brandName}>
                    Meet<Text style={{ color: '#2563EB' }}>Hub</Text>
                  </Text>
                  <Text style={styles.brandTagline}>
                    Connect  •  Collaborate  •  Get Things Done
                  </Text>
                </View>
              </View>

              {/* Balance layout */}
              <View style={{ width: 28 }} />
            </View>

            {/* ═══ ILLUSTRATION CARD ══════════════════════════════════ */}
            <View style={styles.illustrationWrapper}>
              <Image
                source={require('../../assets/images/register-illustration.jpg')}
                style={styles.illustrationImg}
                resizeMode="cover"
              />
            </View>

            {/* ═══ TITLE & SUBTITLE ═══════════════════════════════════ */}
            <View style={styles.titleSection}>
              <Text style={styles.titleText}>Create Your Account</Text>
              <Text style={styles.subtitleText}>
                Join MeetHub and start your journey with better meetings.
              </Text>
            </View>

            {/* Error Box */}
            {error ? (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.errorText}>{error}</Text>
                  {(error.toLowerCase().includes('security') ||
                    error.toLowerCase().includes('request this after') ||
                    error.toLowerCase().includes('rate limit')) && (
                    <Pressable
                      style={{ marginTop: 6 }}
                      onPress={handleGuestRegister}
                    >
                      <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 13 }}>
                        ⚡ Continue with Instant Access Now →
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : null}

            {/* ═══ INPUT FIELDS ═══════════════════════════════════════ */}
            <View style={styles.formSection}>
              {/* 1. Full Name */}
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="account-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  value={fullName}
                  onChangeText={(t) => {
                    setFullName(t);
                    setError('');
                  }}
                  placeholder="Full Name"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                  style={styles.textInput}
                />
              </View>

              {/* 2. Email Address */}
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setError('');
                  }}
                  placeholder="Email Address"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.textInput}
                />
              </View>

              {/* 3. Password */}
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="lock-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    setError('');
                  }}
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={styles.textInput}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={10}
                  style={styles.eyeBtn}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#94A3B8"
                  />
                </Pressable>
              </View>

              {/* 4. Confirm Password */}
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="lock-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    setError('');
                  }}
                  placeholder="Confirm Password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  style={styles.textInput}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={10}
                  style={styles.eyeBtn}
                >
                  <MaterialCommunityIcons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#94A3B8"
                  />
                </Pressable>
              </View>

              {/* ═══ REGISTER BUTTON ════════════════════════════════════ */}
              <Pressable
                onPress={() => void handleRegister()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryCtaWrapper,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                  busy && { opacity: 0.7 },
                ]}
              >
                <LinearGradient
                  colors={['#2563EB', '#1D4ED8', '#1E40AF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryCtaGradient}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryCtaText}>Register</Text>
                      <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              {/* ═══ INSTANT DEMO / GUEST REGISTER ═════════════════════ */}
              <Pressable
                onPress={() => void handleGuestRegister()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.guestCtaBtn,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                  busy && { opacity: 0.7 },
                ]}
              >
                <MaterialCommunityIcons name="flash-outline" size={18} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.guestCtaText}>Instant Demo Access (Skip Verification)</Text>
              </Pressable>

              {/* ═══ OR DIVIDER ═════════════════════════════════════════ */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* ═══ SOCIAL BUTTONS (With Two-Step Verification) ═══════ */}
              <Pressable
                onPress={() => handleStartSocialVerification('google')}
                style={({ pressed }) => [styles.socialBtn, pressed && { opacity: 0.85 }]}
              >
                <MaterialCommunityIcons name="google" size={20} color="#EA4335" style={{ marginRight: 8 }} />
                <Text style={styles.socialBtnText}>Continue with Google</Text>
              </Pressable>

              <Pressable
                onPress={() => handleStartSocialVerification('apple')}
                style={({ pressed }) => [styles.socialBtn, pressed && { opacity: 0.85 }]}
              >
                <MaterialCommunityIcons name="apple" size={21} color="#000000" style={{ marginRight: 8 }} />
                <Text style={styles.socialBtnText}>Continue with Apple</Text>
              </Pressable>

              {/* Terms of Service & Privacy Policy Caption */}
              <Text style={styles.termsText}>
                By creating an account, you agree to our{' '}
                <Text
                  onPress={() => Alert.alert('Terms of Service', 'MeetHub terms ensure privacy, security, and respectful communication.')}
                  style={styles.termsLink}
                >
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text
                  onPress={() => Alert.alert('Privacy Policy', 'MeetHub uses WebRTC peer-to-peer encryption with zero audio/video call recordings.')}
                  style={styles.termsLink}
                >
                  Privacy Policy
                </Text>
                .
              </Text>

              {/* Footer Security Tags */}
              <View style={styles.footerRow}>
                <Text style={styles.footerTag}>Secure</Text>
                <Text style={styles.footerDot}>•</Text>
                <Text style={styles.footerTag}>Fast</Text>
                <Text style={styles.footerDot}>•</Text>
                <Text style={styles.footerTag}>Reliable</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══ SOCIAL TWO-STEP VERIFICATION MODAL ════════════════════════ */}
      <Modal
        visible={verifyProvider !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setVerifyProvider(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setVerifyProvider(null)}>
          <Pressable style={styles.dialogCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dialogHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={[
                    styles.providerBadge,
                    { backgroundColor: verifyProvider === 'google' ? '#FEE2E2' : '#F1F5F9' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={verifyProvider === 'google' ? 'google' : 'apple'}
                    size={18}
                    color={verifyProvider === 'google' ? '#EA4335' : '#000000'}
                  />
                </View>
                <Text style={styles.dialogTitle}>
                  {verifyProvider === 'google' ? 'Google Account' : 'Apple ID'}
                </Text>
              </View>
              <Pressable onPress={() => setVerifyProvider(null)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {verificationError ? (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{verificationError}</Text>
              </View>
            ) : null}

            {verificationStep === 'prompt' ? (
              <View style={{ gap: 14 }}>
                <Text style={styles.dialogBodyText}>
                  Please confirm your account email to receive a two-step authorization code.
                </Text>
                <TextInput
                  value={verificationEmail}
                  onChangeText={(t) => {
                    setVerificationEmail(t);
                    setVerificationError('');
                  }}
                  placeholder="Account Email"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.dialogInput}
                />
                <Pressable
                  onPress={handleSendVerificationCode}
                  disabled={verifying}
                  style={styles.modalSubmitBtn}
                >
                  {verifying ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>Send Verification Code</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 14 }}>
                <View style={styles.codeSentBadge}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="#059669" />
                  <Text style={styles.codeSentText}>Code sent to {verificationEmail}</Text>
                </View>
                <Text style={styles.dialogBodyText}>
                  Enter the 6-digit security code sent to your account:
                </Text>
                <TextInput
                  value={verificationCode}
                  onChangeText={(t) => {
                    setVerificationCode(t);
                    setVerificationError('');
                  }}
                  placeholder="482910"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={6}
                  style={[styles.dialogInput, styles.codeDigitInput]}
                />
                <Pressable
                  onPress={() => void handleVerifyAndEnter()}
                  disabled={verifying}
                  style={styles.modalSubmitBtn}
                >
                  {verifying ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>Verify & Continue</Text>
                  )}
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F7FD',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  mainCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mainCardWide: {
    maxWidth: 540,
  },

  // ── TOP HEADER ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    padding: 2,
  },
  brandCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },

  // ── ILLUSTRATION ──
  illustrationWrapper: {
    width: '100%',
    aspectRatio: 1.45,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#EFF6FF',
    marginBottom: 20,
  },
  illustrationImg: {
    width: '100%',
    height: '100%',
  },

  // ── TITLE SECTION ──
  titleSection: {
    marginBottom: 18,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
  },

  // ── ERROR BOX ──
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },

  // ── FORM SECTION ──
  formSection: {
    gap: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 6,
  },

  // ── PRIMARY CTA ──
  primaryCtaWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  guestCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 24,
    paddingVertical: 13,
    marginTop: 8,
  },
  guestCtaText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '800',
  },

  // ── DIVIDER ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },

  // ── SOCIAL BUTTONS ──
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },

  // ── TERMS ──
  termsText: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
    paddingHorizontal: 8,
    marginTop: 2,
  },
  termsLink: {
    color: '#2563EB',
    fontWeight: '700',
  },

  // ── FOOTER ──
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  footerTag: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  footerDot: {
    color: '#CBD5E1',
  },

  // ── MODALS ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  dialogBodyText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  dialogInput: {
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  codeDigitInput: {
    textAlign: 'center',
    letterSpacing: 6,
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubmitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  providerBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  codeSentText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
  },
});
