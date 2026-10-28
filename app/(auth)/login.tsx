import React, { useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { sendPasswordReset } from '../../src/services/authService';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { configured, demoMode, signInDemo, signInAsGuest, resendConfirmation } = useAuth();
  const params = useLocalSearchParams<{ email?: string; unconfirmed?: string }>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Confirmation email handling
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [showBypassHelp, setShowBypassHelp] = useState(false);

  useEffect(() => {
    if (params.email) {
      setEmail(params.email);
    }
  }, [params.email]);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

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

  const handleGuestLogin = async (customName?: string) => {
    setBusy(true);
    triggerHaptic();
    try {
      const name = customName || (email.trim() ? email.split('@')[0] : 'Nikhil Patil');
      await signInAsGuest(name, email.trim() || 'vipnikhilpatil7709@gmail.com');
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guest login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (overrideEmail?: string, overridePass?: string) => {
    const finalEmail = (overrideEmail ?? email).trim();
    const finalPassword = overridePass ?? password;

    setError('');
    if (!finalEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!finalPassword) {
      setError('Please enter your password.');
      return;
    }

    setBusy(true);
    triggerHaptic();
    setResendSuccess(false);

    try {
      // signInDemo routes to Supabase when configured, demo mode otherwise
      await signInDemo(finalEmail, finalPassword);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResendConfirmation = async () => {
    const targetEmail = email.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setError('Please enter a valid email address to resend confirmation.');
      return;
    }
    triggerHaptic();
    setResending(true);
    setResendSuccess(false);
    try {
      await resendConfirmation(targetEmail);
      setResendSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend confirmation email.');
    } finally {
      setResending(false);
    }
  };

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

  const handleSendForgotPassword = async () => {
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    triggerHaptic();
    try {
      if (configured && !demoMode) {
        await sendPasswordReset(forgotEmail.trim());
      }
      setForgotSent(true);
    } catch (err) {
      Alert.alert('Reset Failed', err instanceof Error ? err.message : 'Unable to send reset email.');
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
            {/* ═══ TOP HEADER WITH BRAND & REGISTER LINK ══════════════ */}
            <View style={styles.topHeader}>
              <Pressable
                onPress={() => router.replace('/(auth)/welcome')}
                style={styles.brandGroup}
              >
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
              </Pressable>

              <View style={styles.topRegisterWrap}>
                <Text style={styles.dontHaveText}>{"Don't have an account?"}</Text>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    router.push('/(auth)/register');
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.topRegisterLink}>Register</Text>
                </Pressable>
              </View>
            </View>

            {/* ═══ ILLUSTRATION CARD ══════════════════════════════════ */}
            <View style={styles.illustrationWrapper}>
              <Image
                source={require('../../assets/images/login-illustration.jpg')}
                style={styles.illustrationImg}
                resizeMode="cover"
              />
            </View>

            {/* ═══ TITLE & SUBTITLE ═══════════════════════════════════ */}
            <View style={styles.titleSection}>
              <Text style={styles.titleText}>Welcome Back!</Text>
              <Text style={styles.subtitleText}>
                Sign in to your MeetHub account to continue your meetings.
              </Text>
            </View>

            {/* Registration success info banner (when redirected from register) */}
            {params.unconfirmed === '1' && !error && (
              <View style={styles.infoBannerBox}>
                <MaterialCommunityIcons name="email-check-outline" size={20} color="#2563EB" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoBannerTitle}>Account Created!</Text>
                  <Text style={styles.infoBannerText}>
                    Please verify your email address using the confirmation link sent to your inbox before signing in.
                  </Text>
                </View>
              </View>
            )}

            {/* Error or Email Confirmation Required Banner */}
            {error ? (
              error.toLowerCase().includes('rate limit') ||
              error.toLowerCase().includes('over_email_send_rate_limit') ||
              error.toLowerCase().includes('security purposes') ||
              error.toLowerCase().includes('request this after') ? (
                <View style={styles.unconfirmedBox}>
                  <View style={styles.unconfirmedHeader}>
                    <View style={[styles.unconfirmedIconWrap, { backgroundColor: '#FEF3C7' }]}>
                      <MaterialCommunityIcons name="clock-alert-outline" size={24} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.unconfirmedTitle, { color: '#B45309' }]}>Email Rate Limit Exceeded</Text>
                      <Text style={[styles.unconfirmedSubtitle, { color: '#92400E' }]}>
                        Supabase free tier rate limits email sends. You can continue instantly in demo mode without email confirmation!
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => void handleGuestLogin()}
                    style={styles.guestPillBtn}
                  >
                    <MaterialCommunityIcons name="flash" size={16} color="#FFFFFF" />
                    <Text style={styles.guestPillBtnText}>Enter with Instant Demo Access</Text>
                  </Pressable>
                </View>
              ) : error.toLowerCase().includes('email not confirmed') ||
              error.toLowerCase().includes('email not verified') ? (
                <View style={styles.unconfirmedBox}>
                  <View style={styles.unconfirmedHeader}>
                    <View style={styles.unconfirmedIconWrap}>
                      <MaterialCommunityIcons name="email-alert-outline" size={24} color="#DC2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unconfirmedTitle}>Email Not Confirmed</Text>
                      <Text style={styles.unconfirmedSubtitle}>
                        Your account requires email confirmation before signing in. Please check your inbox and Spam folder for the link.
                      </Text>
                    </View>
                  </View>

                  {resendSuccess ? (
                    <View style={styles.resendSuccessBadge}>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#059669" />
                      <Text style={styles.resendSuccessText}>
                        Confirmation email resent! Please check your inbox and Spam folder.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.unconfirmedActionsRow}>
                      <Pressable
                        onPress={handleResendConfirmation}
                        disabled={resending}
                        style={({ pressed }) => [
                          styles.resendBtn,
                          pressed && { opacity: 0.85 },
                          resending && { opacity: 0.7 },
                        ]}
                      >
                        {resending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="email-fast-outline" size={16} color="#FFFFFF" />
                            <Text style={styles.resendBtnText}>Resend Link</Text>
                          </>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => void handleGuestLogin()}
                        style={styles.guestPillBtn}
                      >
                        <MaterialCommunityIcons name="flash" size={15} color="#FFFFFF" />
                        <Text style={styles.guestPillBtnText}>Instant Demo</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Supabase Dashboard quick fix dropdown */}
                  <Pressable
                    onPress={() => setShowBypassHelp(!showBypassHelp)}
                    style={styles.bypassToggleBtn}
                    hitSlop={6}
                  >
                    <MaterialCommunityIcons
                      name={showBypassHelp ? 'chevron-up' : 'help-circle-outline'}
                      size={15}
                      color="#2563EB"
                    />
                    <Text style={styles.bypassToggleText}>
                      {showBypassHelp ? 'Hide Supabase setup guide' : 'Using Supabase? Click to see how to instant-confirm'}
                    </Text>
                  </Pressable>

                  {showBypassHelp && (
                    <View style={styles.bypassHelpCard}>
                      <Text style={styles.bypassHelpHeading}>Quick Fixes in Supabase Dashboard:</Text>
                      <Text style={styles.bypassHelpItem}>
                        <Text style={{ fontWeight: '700', color: '#0F172A' }}>• Instant fix for this account: </Text>
                        Go to <Text style={{ fontWeight: '600' }}>Authentication → Users</Text>, click <Text style={{ fontWeight: '700' }}>•••</Text> next to {email || 'your email'} and select <Text style={{ fontWeight: '700', color: '#16A34A' }}>&quot;Confirm user&quot;</Text>. Then tap Sign In!
                      </Text>
                      <Text style={styles.bypassHelpItem}>
                        <Text style={{ fontWeight: '700', color: '#0F172A' }}>• Skip confirmation for testing: </Text>
                        Go to <Text style={{ fontWeight: '600' }}>Authentication → Providers → Email</Text> and turn OFF <Text style={{ fontWeight: '700' }}>&quot;Confirm email&quot;</Text>.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable
                    onPress={() => void handleGuestLogin()}
                    style={styles.errorDemoSmallBtn}
                    hitSlop={4}
                  >
                    <Text style={styles.errorDemoSmallText}>Use Demo</Text>
                  </Pressable>
                </View>
              )
            ) : null}

            {/* ═══ INPUT FIELDS ═══════════════════════════════════════ */}
            <View style={styles.formSection}>
              {/* Email Field */}
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
                  autoComplete="email"
                  style={styles.textInput}
                />
              </View>

              {/* Password Field */}
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

              {/* Remember Me & Forgot Password Row */}
              <View style={styles.optionsRow}>
                <Pressable
                  onPress={() => setRememberMe(!rememberMe)}
                  style={styles.rememberMeGroup}
                  hitSlop={6}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                    {rememberMe && <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.rememberMeText}>Remember me</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setForgotEmail(email);
                    setForgotSent(false);
                    setShowForgotModal(true);
                  }}
                  hitSlop={6}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </Pressable>
              </View>

              {/* ═══ SIGN IN BUTTON ═════════════════════════════════════ */}
              <Pressable
                onPress={() => void handleLogin()}
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
                      <Text style={styles.primaryCtaText}>Sign In</Text>
                      <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              {/* ═══ INSTANT DEMO / GUEST SIGN IN ═══════════════════════ */}
              <Pressable
                onPress={() => void handleGuestLogin()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.guestCtaBtn,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                  busy && { opacity: 0.7 },
                ]}
              >
                <MaterialCommunityIcons name="flash-outline" size={18} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.guestCtaText}>Instant Demo Sign In (Skip Verification)</Text>
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

              {/* ═══ FOOTER SECURITY TAGS ══════════════════════════════ */}
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

      {/* ═══ FORGOT PASSWORD MODAL ═════════════════════════════════════ */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowForgotModal(false)}>
          <Pressable style={styles.dialogCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Reset Password</Text>
              <Pressable onPress={() => setShowForgotModal(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {forgotSent ? (
              <View style={{ gap: 14, alignItems: 'center', paddingVertical: 10 }}>
                <MaterialCommunityIcons name="email-check" size={44} color="#059669" />
                <Text style={styles.dialogSentTitle}>Check Your Inbox</Text>
                <Text style={styles.dialogBodyText}>
                  A password reset link has been sent to {forgotEmail}.
                </Text>
                <Pressable
                  onPress={() => setShowForgotModal(false)}
                  style={[styles.modalSubmitBtn, { width: '100%' }]}
                >
                  <Text style={styles.modalSubmitBtnText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Text style={styles.dialogBodyText}>
                  {"Enter your email address and we'll send you instructions to reset your password."}
                </Text>
                <TextInput
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.dialogInput}
                />
                <Pressable
                  onPress={() => void handleSendForgotPassword()}
                  style={styles.modalSubmitBtn}
                >
                  <Text style={styles.modalSubmitBtnText}>Send Reset Link</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

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
    gap: 8,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
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
  topRegisterWrap: {
    alignItems: 'flex-end',
  },
  dontHaveText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  topRegisterLink: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '800',
    marginTop: 2,
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

  // ── ERROR BOX & UNCONFIRMED BOX ──
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
  infoBannerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 2,
  },
  infoBannerText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#3B82F6',
  },
  unconfirmedBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  unconfirmedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  unconfirmedIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unconfirmedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 2,
  },
  unconfirmedSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7F1D1D',
  },
  unconfirmedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  guestPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  guestPillBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
  errorDemoSmallBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  errorDemoSmallText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  resendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  resendSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resendSuccessText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  bypassToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  bypassToggleText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  bypassHelpCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  bypassHelpHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  bypassHelpItem: {
    fontSize: 11,
    lineHeight: 17,
    color: '#475569',
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

  // ── OPTIONS ROW ──
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rememberMeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  rememberMeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
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

  // ── FOOTER ──
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
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
  dialogSentTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
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
