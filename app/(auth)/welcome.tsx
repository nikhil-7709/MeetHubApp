import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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

const SLIDES = [
  {
    tagline: 'Connect  •  Collaborate  •  Get Things Done',
    description: 'Join meetings, create rooms, and connect with your team anytime, anywhere.',
  },
  {
    tagline: 'Ultra-Low Latency  •  Encrypted Media  •  HD Audio',
    description: 'Powered by WebRTC peer-to-peer technology with zero call recording.',
  },
  {
    tagline: 'Instant Rooms  •  Easy Codes  •  Multi-User Grid',
    description: 'Host standups, sync with teammates, and share your screen in seconds.',
  },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { signInAsGuest } = useAuth();

  const [activeSlide, setActiveSlide] = useState(0);

  // Verification Modal State
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

  // Open verification popup instead of opening app directly
  const handleStartSocialVerification = (provider: 'google' | 'apple') => {
    triggerHaptic();
    setVerifyProvider(provider);
    setVerificationStep('prompt');
    setVerificationEmail(provider === 'google' ? 'alex.rivera@gmail.com' : 'alex.rivera@icloud.com');
    setVerificationCode('');
    setVerificationError('');
  };

  // Step 1: Send verification security code
  const handleSendVerificationCode = () => {
    triggerHaptic();
    if (!verificationEmail.trim() || !verificationEmail.includes('@')) {
      setVerificationError('Please enter a valid account email.');
      return;
    }
    setVerificationError('');
    setVerifying(true);

    setTimeout(() => {
      setVerifying(false);
      setVerificationStep('code');
      // Autofill 6-digit one-time security pass code
      setVerificationCode('482910');
      Alert.alert(
        'Security Code Sent',
        `A 6-digit authorization code has been sent to ${verificationEmail}. Use code: 482910`
      );
    }, 900);
  };

  // Step 2: Confirm code and authenticate
  const handleVerifyAndEnter = async () => {
    triggerHaptic();
    if (verificationCode.trim().length !== 6) {
      setVerificationError('Please enter the 6-digit security code.');
      return;
    }

    setVerificationError('');
    setVerifying(true);

    try {
      // Authenticate securely as guest/demo
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 14),
            paddingBottom: Math.max(insets.bottom, 24) + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ TOP NAVBAR ═════════════════════════════════════════════════════ */}
        <LinearGradient
          colors={['#0E1E4D', '#122B68', '#1A3B8B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.navBar}
        >
          {/* Brand Logo */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setActiveSlide((prev) => (prev + 1) % SLIDES.length);
            }}
            style={styles.navLogoRow}
          >
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="video-vintage" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.navBrandText}>
              Meet<Text style={{ color: '#60A5FA' }}>Hub</Text>
            </Text>
          </Pressable>

          {/* Right Action Buttons */}
          <View style={styles.navRightActions}>
            <Pressable
              onPress={() => {
                triggerHaptic();
                router.push('/(auth)/login');
              }}
              style={({ pressed }) => [styles.navSignInBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel="Sign In"
            >
              <Text style={styles.navSignInText}>Sign In</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic();
                router.push('/(auth)/register');
              }}
              style={({ pressed }) => [
                styles.navRegisterBtn,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Register"
            >
              <Text style={styles.navRegisterText}>Register</Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* ═══ HERO SECTION ═══════════════════════════════════════════════════ */}
        <View style={[styles.heroWrap, isWide && styles.heroWrapWide]}>
          <Text style={styles.welcomeHeading}>Welcome to</Text>
          <Text style={styles.brandTitle}>
            Meet<Text style={{ color: '#2563EB' }}>Hub</Text>
          </Text>

          <Text style={styles.tagline}>
            {SLIDES[activeSlide].tagline}
          </Text>

          <Text style={styles.subDescription}>
            {SLIDES[activeSlide].description}
          </Text>

          {/* ═══ ILLUSTRATION ═════════════════════════════════════════════════ */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setActiveSlide((prev) => (prev + 1) % SLIDES.length);
            }}
            style={styles.illustrationCard}
          >
            <Image
              source={require('../../assets/images/welcome-illustration.jpg')}
              style={styles.illustrationImage}
              resizeMode="cover"
            />
          </Pressable>

          {/* ═══ 4 KEY PILLARS / HIGHLIGHTS ════════════════════════════════════ */}
          <View style={styles.pillarsGrid}>
            {/* Pillar 1: HD Video & Audio */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                Alert.alert('HD Video & Audio', 'MeetHub provides crystal clear 720p HD video and Opus spatial audio encoded via WebRTC.');
              }}
              style={({ pressed }) => [styles.pillarItem, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.pillarIconCircle, { backgroundColor: '#2563EB' }]}>
                <MaterialCommunityIcons name="video" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.pillarTitle}>HD Video & Audio</Text>
              <Text style={styles.pillarDesc}>Clear and stable meetings</Text>
            </Pressable>

            {/* Pillar 2: Create & Join */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                router.push('/(auth)/login');
              }}
              style={({ pressed }) => [styles.pillarItem, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.pillarIconCircle, { backgroundColor: '#059669' }]}>
                <MaterialCommunityIcons name="account-group" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.pillarTitle}>Create & Join</Text>
              <Text style={styles.pillarDesc}>Start or join meetings with one click</Text>
            </Pressable>

            {/* Pillar 3: Chat & Share */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                Alert.alert('Chat & Share', 'Real-time text chat, screen sharing, and reactions during every meeting room.');
              }}
              style={({ pressed }) => [styles.pillarItem, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.pillarIconCircle, { backgroundColor: '#9333EA' }]}>
                <MaterialCommunityIcons name="message-text" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.pillarTitle}>Chat & Share</Text>
              <Text style={styles.pillarDesc}>Share messages, files and ideas</Text>
            </Pressable>

            {/* Pillar 4: Secure */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                Alert.alert('End-to-End Secure', 'Peer-to-peer WebRTC DTLS/SRTP encryption. Your streams are private and never recorded.');
              }}
              style={({ pressed }) => [styles.pillarItem, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.pillarIconCircle, { backgroundColor: '#F59E0B' }]}>
                <MaterialCommunityIcons name="shield-check" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.pillarTitle}>Secure</Text>
              <Text style={styles.pillarDesc}>Your data is always protected</Text>
            </Pressable>
          </View>

          {/* ═══ CALL TO ACTION BUTTONS ═══════════════════════════════════════ */}
          <View style={styles.ctaContainer}>
            {/* 1. Primary Sign In Pill Button */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                router.push('/(auth)/login');
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sign In"
            >
              <MaterialCommunityIcons name="account-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Sign In</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </Pressable>

            {/* 2. Secondary Create New Account Pill Button */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                router.push('/(auth)/register');
              }}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.88, backgroundColor: '#EFF6FF' },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Create New Account"
            >
              <MaterialCommunityIcons name="account-plus-outline" size={20} color="#2563EB" style={{ marginRight: 8 }} />
              <Text style={styles.secondaryBtnText}>Create New Account</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#2563EB" style={{ marginLeft: 6 }} />
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Continue Buttons (Triggers Verification) */}
            <View style={styles.socialRow}>
              <Pressable
                onPress={() => handleStartSocialVerification('google')}
                style={({ pressed }) => [styles.socialBtn, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                <MaterialCommunityIcons name="google" size={18} color="#EA4335" style={{ marginRight: 6 }} />
                <Text style={styles.socialBtnText}>Continue with Google</Text>
              </Pressable>

              <Pressable
                onPress={() => handleStartSocialVerification('apple')}
                style={({ pressed }) => [styles.socialBtn, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel="Continue with Apple"
              >
                <MaterialCommunityIcons name="apple" size={19} color="#000000" style={{ marginRight: 6 }} />
                <Text style={styles.socialBtnText}>Continue with Apple</Text>
              </Pressable>
            </View>

            {/* Carousel Dots */}
            <View style={styles.carouselDots}>
              {SLIDES.map((_, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    triggerHaptic();
                    setActiveSlide(index);
                  }}
                  style={[
                    styles.dot,
                    activeSlide === index && styles.dotActive,
                  ]}
                  hitSlop={8}
                />
              ))}
            </View>

            {/* Footer Tagline */}
            <View style={styles.footerWrap}>
              <View style={styles.footerLine} />
              <Text style={styles.footerText}>MeetHub  –  Better Meetings, Brighter Ideas</Text>
              <View style={styles.footerLine} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECURITY VERIFICATION DIALOG MODAL
         ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={verifyProvider !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setVerifyProvider(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setVerifyProvider(null)}>
          <Pressable style={styles.verifyCard} onPress={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <View style={styles.verifyHeader}>
              <View style={styles.verifyHeaderLeft}>
                <View
                  style={[
                    styles.verifyProviderBadge,
                    { backgroundColor: verifyProvider === 'google' ? '#FEE2E2' : '#F1F5F9' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={verifyProvider === 'google' ? 'google' : 'apple'}
                    size={20}
                    color={verifyProvider === 'google' ? '#EA4335' : '#000000'}
                  />
                </View>
                <View>
                  <Text style={styles.verifyTitle}>
                    {verifyProvider === 'google' ? 'Google Verification' : 'Apple ID Verification'}
                  </Text>
                  <Text style={styles.verifySub}>Two-Step Account Authentication</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setVerifyProvider(null)}
                hitSlop={10}
                style={styles.verifyCloseBtn}
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {verificationError ? (
              <View style={styles.verifyErrorBox}>
                <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.verifyErrorText}>{verificationError}</Text>
              </View>
            ) : null}

            {verificationStep === 'prompt' ? (
              // Step 1: Confirm Email & Send Security Code
              <View style={{ gap: 14 }}>
                <Text style={styles.verifyBodyText}>
                  Please confirm your {verifyProvider === 'google' ? 'Google Account' : 'Apple ID'} email to receive a secure authorization code before opening MeetHub.
                </Text>

                <View>
                  <Text style={styles.inputFieldLabel}>ACCOUNT EMAIL</Text>
                  <TextInput
                    value={verificationEmail}
                    onChangeText={(t) => {
                      setVerificationEmail(t);
                      setVerificationError('');
                    }}
                    placeholder="Enter account email"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.verifyInput}
                  />
                </View>

                <Pressable
                  onPress={handleSendVerificationCode}
                  disabled={verifying}
                  style={({ pressed }) => [
                    styles.verifySubmitBtn,
                    pressed && { opacity: 0.9 },
                    verifying && { opacity: 0.7 },
                  ]}
                >
                  {verifying ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="send" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.verifySubmitBtnText}>Send Verification Code</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              // Step 2: Enter 6-digit Code
              <View style={{ gap: 14 }}>
                <View style={styles.verifySentBanner}>
                  <MaterialCommunityIcons name="email-check" size={18} color="#059669" />
                  <Text style={styles.verifySentText}>
                    Code sent to <Text style={{ fontWeight: '700' }}>{verificationEmail}</Text>
                  </Text>
                </View>

                <Text style={styles.verifyBodyText}>
                  Enter the 6-digit verification code below to authorize your session.
                </Text>

                <View>
                  <Text style={styles.inputFieldLabel}>6-DIGIT CODE</Text>
                  <TextInput
                    value={verificationCode}
                    onChangeText={(t) => {
                      setVerificationCode(t);
                      setVerificationError('');
                    }}
                    placeholder="e.g. 482910"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.verifyInput, styles.verifyCodeInput]}
                  />
                </View>

                <Pressable
                  onPress={() => void handleVerifyAndEnter()}
                  disabled={verifying}
                  style={({ pressed }) => [
                    styles.verifySubmitBtn,
                    pressed && { opacity: 0.9 },
                    verifying && { opacity: 0.7 },
                  ]}
                >
                  {verifying ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="shield-check" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.verifySubmitBtnText}>Verify & Open App</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => setVerificationStep('prompt')}
                  style={{ alignSelf: 'center', paddingVertical: 4 }}
                >
                  <Text style={styles.verifyChangeEmailText}>Change email address</Text>
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
  },

  // ── TOP NAV BAR ──
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#0E1E4D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  navLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBrandText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  navRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navSignInBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navSignInText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  navRegisterBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  navRegisterText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '800',
  },

  // ── HERO TEXT ──
  heroWrap: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    maxWidth: 620,
    marginHorizontal: 'auto',
    width: '100%',
  },
  heroWrapWide: {
    maxWidth: 720,
  },
  welcomeHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 44,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1.2,
    textAlign: 'center',
    marginBottom: 12,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 8,
  },
  subDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 420,
    marginBottom: 24,
  },

  // ── ILLUSTRATION CARD ──
  illustrationCard: {
    width: '100%',
    aspectRatio: 1.35,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },

  // ── 4 PILLARS GRID ──
  pillarsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
    gap: 8,
  },
  pillarItem: {
    flex: 1,
    alignItems: 'center',
  },
  pillarIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  pillarTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  pillarDesc: {
    fontSize: 11,
    lineHeight: 15,
    color: '#64748B',
    textAlign: 'center',
  },

  // ── CTA ACTIONS ──
  ctaContainer: {
    width: '100%',
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginBottom: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  secondaryBtnText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '800',
  },

  // ── DIVIDER ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // ── SOCIAL ROW ──
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  socialBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  // ── CAROUSEL DOTS ──
  carouselDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },

  // ── FOOTER ──
  footerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  footerLine: {
    width: 24,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  footerText: {
    marginHorizontal: 10,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // ── VERIFICATION MODAL ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  verifyCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  verifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  verifyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verifyProviderBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  verifySub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  verifyCloseBtn: {
    padding: 4,
  },
  verifyErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  verifyErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  verifyBodyText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  inputFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  verifyInput: {
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  verifyCodeInput: {
    letterSpacing: 6,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  verifySubmitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  verifySubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  verifySentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  verifySentText: {
    color: '#065F46',
    fontSize: 12,
  },
  verifyChangeEmailText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
});
