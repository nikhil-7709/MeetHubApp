import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';
// AppUser type comes from AuthContext (Supabase-compatible)

export default function ProfileScreen() {
  const { user, demoMode, updateNameDemo, signOutDemo } = useAuth();
  const { dark, colors, toggle } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Profile Edit State
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName ?? '');
  const [statusMessage, setStatusMessage] = useState('Available for calls');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Modal states
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showMediaDefaultsModal, setShowMediaDefaultsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Preference toggles
  const [reminderAlerts, setReminderAlerts] = useState(true);
  const [chatAlerts, setChatAlerts] = useState(true);
  const [soundHaptics, setSoundHaptics] = useState(true);

  // Media default toggles
  const [defaultMuteMic, setDefaultMuteMic] = useState(false);
  const [defaultTurnOffCam, setDefaultTurnOffCam] = useState(false);
  const [hdVideo, setHdVideo] = useState(true);
  const [mirrorVideo, setMirrorVideo] = useState(true);

  const triggerHaptic = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* ignore */
    }
  };

  // ── Save Profile Name ────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!user || name.trim().length < 2) {
      setError('Name must contain at least 2 characters.');
      return;
    }
    setBusy(true);
    setError('');
    triggerHaptic();

    try {
      // updateNameDemo routes to Supabase, Firebase, or demo mode via AuthContext
      await updateNameDemo(name.trim());
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update profile.');
    } finally {
      setBusy(false);
    }
  };

  // ── Copy Email ──────────────────────────────────────────────────────────────
  const handleCopyEmail = async () => {
    if (!user?.email) return;
    triggerHaptic();
    await Clipboard.setStringAsync(user.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // ── Sign Out ─────────────────────────────────────────────────────────────────
  const handleConfirmSignOut = async () => {
    setShowSignOutModal(false);
    triggerHaptic();
    try {
      // signOutDemo routes to Supabase, Firebase, or demo mode via AuthContext
      await signOutDemo();
      router.replace('/(auth)/welcome');
    } catch (reason) {
      Alert.alert('Sign out', reason instanceof Error ? reason.message : 'Sign-out failed.');
    }
  };

  const userInitial = (user?.displayName ?? user?.email ?? 'M').slice(0, 1).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0A0F1D' : '#F8FAFC' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ═══ TOP HEADER ═════════════════════════════════════════════════════ */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Your MeetHub account & app preferences.
          </Text>
        </View>

        {/* ═══ USER HERO CARD ═════════════════════════════════════════════════ */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: dark ? '#131927' : '#FFFFFF',
              borderColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
              shadowColor: dark ? '#000000' : '#4F46E5',
            },
          ]}
        >
          {/* Avatar with Glow Ring */}
          <View style={styles.avatarWrapper}>
            <View
              style={[
                styles.avatarRing,
                { backgroundColor: dark ? 'rgba(79, 70, 229, 0.2)' : '#EEF2FF' },
              ]}
            >
              <Text style={styles.avatarInitial}>{userInitial}</Text>
            </View>
            <Pressable
              onPress={() => {
                setName(user?.displayName ?? '');
                setEditing(true);
              }}
              style={styles.avatarEditBadge}
              hitSlop={6}
            >
              <MaterialCommunityIcons name="pencil" size={13} color="white" />
            </Pressable>
          </View>

          {/* User Details */}
          <Text style={[styles.userName, { color: colors.text }]}>
            {user?.displayName ?? 'MeetHub Member'}
          </Text>

          <Pressable onPress={handleCopyEmail} style={styles.emailChip} hitSlop={8}>
            <Text style={[styles.userEmail, { color: colors.muted }]}>{user?.email}</Text>
            <MaterialCommunityIcons
              name={copiedEmail ? 'check' : 'content-copy'}
              size={13}
              color={copiedEmail ? '#10B981' : colors.muted}
            />
          </Pressable>

          {/* Account Status Badge */}
          <View
            style={[
              styles.badgeRow,
              {
                backgroundColor: demoMode
                  ? dark
                    ? 'rgba(79, 70, 229, 0.15)'
                    : '#EFF6FF'
                  : dark
                  ? 'rgba(16, 185, 129, 0.15)'
                  : '#ECFDF5',
              },
            ]}
          >
            <View
              style={[
                styles.badgeDot,
                { backgroundColor: demoMode ? '#4F46E5' : '#10B981' },
              ]}
            />
            <Text
              style={[
                styles.badgeText,
                { color: demoMode ? '#4F46E5' : '#10B981' },
              ]}
            >
              {demoMode ? 'Local Demo Account' : 'Verified Firebase Account'}
            </Text>
          </View>

          {/* Quick Metrics */}
          <View
            style={[
              styles.metricsRow,
              {
                borderTopColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
              },
            ]}
          >
            <View style={styles.metricItem}>
              <MaterialCommunityIcons name="shield-check" size={18} color="#10B981" />
              <Text style={[styles.metricLabel, { color: colors.text }]}>WebRTC P2P</Text>
              <Text style={[styles.metricSub, { color: colors.muted }]}>Encrypted</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <MaterialCommunityIcons name="video-check" size={18} color="#2563EB" />
              <Text style={[styles.metricLabel, { color: colors.text }]}>HD 720p</Text>
              <Text style={[styles.metricSub, { color: colors.muted }]}>Video ready</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <MaterialCommunityIcons name="microphone" size={18} color="#8B5CF6" />
              <Text style={[styles.metricLabel, { color: colors.text }]}>Opus Audio</Text>
              <Text style={[styles.metricSub, { color: colors.muted }]}>Crystal clear</Text>
            </View>
          </View>
        </View>

        {/* ═══ SECTION 1: ACCOUNT ═════════════════════════════════════════════ */}
        <Text style={[styles.sectionHeading, { color: colors.muted }]}>ACCOUNT</Text>
        <View
          style={[
            styles.settingsBox,
            {
              backgroundColor: dark ? '#131927' : '#FFFFFF',
              borderColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          {/* Edit Profile Button */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setName(user?.displayName ?? '');
              setEditing(true);
            }}
            style={styles.settingRow}
          >
            <View style={[styles.settingIconCircle, { backgroundColor: '#EEF2FF' }]}>
              <MaterialCommunityIcons name="account-edit-outline" size={20} color="#4F46E5" />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Edit profile</Text>
              <Text style={[styles.settingSub, { color: colors.muted }]}>
                Change your name & status message
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        </View>

        {/* ═══ SECTION 2: PREFERENCES ═════════════════════════════════════════ */}
        <Text style={[styles.sectionHeading, { color: colors.muted }]}>PREFERENCES</Text>
        <View
          style={[
            styles.settingsBox,
            {
              backgroundColor: dark ? '#131927' : '#FFFFFF',
              borderColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          {/* Notifications Modal trigger */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setShowNotificationsModal(true);
            }}
            style={styles.settingRow}
          >
            <View style={[styles.settingIconCircle, { backgroundColor: '#F3E8FF' }]}>
              <MaterialCommunityIcons name="bell-ring-outline" size={20} color="#9333EA" />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Notification preferences
              </Text>
              <Text style={[styles.settingSub, { color: colors.muted }]}>
                Meeting alerts, sounds & reminders
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: dark ? '#1E293B' : '#F1F5F9' }]} />

          {/* Audio & Video Defaults trigger */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setShowMediaDefaultsModal(true);
            }}
            style={styles.settingRow}
          >
            <View style={[styles.settingIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <MaterialCommunityIcons name="camera-control" size={20} color="#0284C7" />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Audio & video settings
              </Text>
              <Text style={[styles.settingSub, { color: colors.muted }]}>
                Default camera/mic states & HD video
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: dark ? '#1E293B' : '#F1F5F9' }]} />

          {/* Dark Mode Switch */}
          <View style={styles.settingRow}>
            <View style={[styles.settingIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="theme-light-dark" size={20} color="#D97706" />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Dark mode</Text>
              <Text style={[styles.settingSub, { color: colors.muted }]}>
                {dark ? 'Dark theme enabled' : 'Light theme enabled'}
              </Text>
            </View>
            <Switch
              value={dark}
              onValueChange={() => {
                triggerHaptic();
                toggle();
              }}
              trackColor={{ true: '#4F46E5', false: '#CBD5E1' }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            />
          </View>
        </View>

        {/* ═══ SECTION 3: ABOUT & SECURITY ════════════════════════════════════ */}
        <Text style={[styles.sectionHeading, { color: colors.muted }]}>SECURITY & ABOUT</Text>
        <View
          style={[
            styles.settingsBox,
            {
              backgroundColor: dark ? '#131927' : '#FFFFFF',
              borderColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          {/* Privacy */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setShowPrivacyModal(true);
            }}
            style={styles.settingRow}
          >
            <View style={[styles.settingIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#16A34A" />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>
                Privacy & encryption
              </Text>
              <Text style={[styles.settingSub, { color: colors.muted }]}>
                Peer-to-peer security & data handling
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: dark ? '#1E293B' : '#F1F5F9' }]} />

          {/* About MeetHub */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setShowAboutModal(true);
            }}
            style={styles.settingRow}
          >
            <View style={[styles.settingIconCircle, { backgroundColor: '#F1F5F9' }]}>
              <MaterialCommunityIcons name="information-outline" size={20} color="#64748B" />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>About MeetHub</Text>
              <Text style={[styles.settingSub, { color: colors.muted }]}>Version 2.5.0 · Release info</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        </View>

        {/* ═══ SIGN OUT BUTTON (with plenty of scroll padding) ════════════════ */}
        <Pressable
          onPress={() => {
            triggerHaptic();
            setShowSignOutModal(true);
          }}
          style={({ pressed }) => [
            styles.signOutBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
        >
          <MaterialCommunityIcons name="logout-variant" size={20} color="#EF4444" />
          <Text style={styles.signOutBtnText}>Sign out of MeetHub</Text>
        </Pressable>

        <Text style={[styles.versionCaption, { color: colors.muted }]}>
          MeetHub v2.5.0 · Built with WebRTC & Expo
        </Text>
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 1: EDIT PROFILE MODAL
         ═══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEditing(false)}>
          <Pressable style={styles.modalDialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={() => setEditing(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={22} color="#94A3B8" />
              </Pressable>
            </View>

            {error ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>DISPLAY NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor="#94A3B8"
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>STATUS MESSAGE</Text>
            <TextInput
              value={statusMessage}
              onChangeText={setStatusMessage}
              placeholder="e.g. Available for meetings"
              placeholderTextColor="#94A3B8"
              style={styles.modalInput}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEditing(false)}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSaveName()}
                disabled={busy}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                <Text style={styles.modalBtnPrimaryText}>
                  {busy ? 'Saving…' : 'Save Changes'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 2: NOTIFICATION PREFERENCES
         ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showNotificationsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowNotificationsModal(false)}>
          <Pressable style={styles.modalDialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <Pressable onPress={() => setShowNotificationsModal(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={22} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={styles.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.preferenceTitle}>Meeting Reminders</Text>
                <Text style={styles.preferenceSub}>Alert 10 minutes before calls</Text>
              </View>
              <Switch
                value={reminderAlerts}
                onValueChange={(v) => {
                  triggerHaptic();
                  setReminderAlerts(v);
                }}
                trackColor={{ true: '#4F46E5', false: '#334155' }}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.preferenceTitle}>In-Call Chat Alerts</Text>
                <Text style={styles.preferenceSub}>Notify when messages arrive</Text>
              </View>
              <Switch
                value={chatAlerts}
                onValueChange={(v) => {
                  triggerHaptic();
                  setChatAlerts(v);
                }}
                trackColor={{ true: '#4F46E5', false: '#334155' }}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.preferenceTitle}>Sound & Haptic Feedback</Text>
                <Text style={styles.preferenceSub}>Play audio tones on buttons</Text>
              </View>
              <Switch
                value={soundHaptics}
                onValueChange={(v) => {
                  triggerHaptic();
                  setSoundHaptics(v);
                }}
                trackColor={{ true: '#4F46E5', false: '#334155' }}
              />
            </View>

            <Pressable
              onPress={() => setShowNotificationsModal(false)}
              style={[styles.modalBtn, styles.modalBtnPrimary, { marginTop: 14 }]}
            >
              <Text style={styles.modalBtnPrimaryText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 3: AUDIO & VIDEO DEFAULT PREFERENCES
         ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showMediaDefaultsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMediaDefaultsModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowMediaDefaultsModal(false)}>
          <Pressable style={styles.modalDialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Audio & Video Defaults</Text>
              <Pressable onPress={() => setShowMediaDefaultsModal(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={22} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={styles.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.preferenceTitle}>Mute Mic on Join</Text>
                <Text style={styles.preferenceSub}>Always enter meetings muted</Text>
              </View>
              <Switch
                value={defaultMuteMic}
                onValueChange={(v) => {
                  triggerHaptic();
                  setDefaultMuteMic(v);
                }}
                trackColor={{ true: '#4F46E5', false: '#334155' }}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.preferenceTitle}>Turn Off Camera on Join</Text>
                <Text style={styles.preferenceSub}>Always join with video off</Text>
              </View>
              <Switch
                value={defaultTurnOffCam}
                onValueChange={(v) => {
                  triggerHaptic();
                  setDefaultTurnOffCam(v);
                }}
                trackColor={{ true: '#4F46E5', false: '#334155' }}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.preferenceTitle}>HD Video (720p)</Text>
                <Text style={styles.preferenceSub}>Enable high resolution stream</Text>
              </View>
              <Switch
                value={hdVideo}
                onValueChange={(v) => {
                  triggerHaptic();
                  setHdVideo(v);
                }}
                trackColor={{ true: '#4F46E5', false: '#334155' }}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.preferenceTitle}>Mirror My Video</Text>
                <Text style={styles.preferenceSub}>Display natural selfie view</Text>
              </View>
              <Switch
                value={mirrorVideo}
                onValueChange={(v) => {
                  triggerHaptic();
                  setMirrorVideo(v);
                }}
                trackColor={{ true: '#4F46E5', false: '#334155' }}
              />
            </View>

            <Pressable
              onPress={() => setShowMediaDefaultsModal(false)}
              style={[styles.modalBtn, styles.modalBtnPrimary, { marginTop: 14 }]}
            >
              <Text style={styles.modalBtnPrimaryText}>Save Preferences</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 4: PRIVACY & ENCRYPTION
         ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPrivacyModal(false)}>
          <Pressable style={styles.modalDialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy & Security</Text>
              <Pressable onPress={() => setShowPrivacyModal(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={22} color="#94A3B8" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              <View style={styles.privacyFeature}>
                <MaterialCommunityIcons name="lock" size={20} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyTitle}>Peer-to-Peer Encryption</Text>
                  <Text style={styles.privacyDesc}>
                    Video and audio streams are transmitted directly between participants via WebRTC DTLS/SRTP encryption.
                  </Text>
                </View>
              </View>

              <View style={styles.privacyFeature}>
                <MaterialCommunityIcons name="cloud-off-outline" size={20} color="#2563EB" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyTitle}>No Call Recordings</Text>
                  <Text style={styles.privacyDesc}>
                    Calls are never recorded or stored on any server. Once the meeting ends, room media is completely purged.
                  </Text>
                </View>
              </View>

              <View style={styles.privacyFeature}>
                <MaterialCommunityIcons name="database-check-outline" size={20} color="#8B5CF6" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyTitle}>Data Minimization</Text>
                  <Text style={styles.privacyDesc}>
                    {demoMode
                      ? 'In Demo Mode, meeting data is kept in your local device storage only.'
                      : 'Firebase Firestore stores meeting metadata with secure role-based rules.'}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <Pressable
              onPress={() => setShowPrivacyModal(false)}
              style={[styles.modalBtn, styles.modalBtnPrimary, { marginTop: 14 }]}
            >
              <Text style={styles.modalBtnPrimaryText}>Understood</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 5: ABOUT MEETHUB
         ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showAboutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAboutModal(false)}>
          <Pressable style={styles.modalDialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>About MeetHub</Text>
              <Pressable onPress={() => setShowAboutModal(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={22} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 14 }}>
              <View style={styles.aboutLogoBox}>
                <MaterialCommunityIcons name="video-wireless" size={36} color="#4F46E5" />
              </View>
              <Text style={styles.aboutAppName}>MeetHub</Text>
              <Text style={styles.aboutVersion}>Version 2.5.0</Text>
            </View>

            <Text style={styles.aboutDesc}>
              MeetHub is a high-performance cross-platform video calling application built with Expo, React Native, and WebRTC.
            </Text>

            <Pressable
              onPress={() => setShowAboutModal(false)}
              style={[styles.modalBtn, styles.modalBtnPrimary, { marginTop: 14 }]}
            >
              <Text style={styles.modalBtnPrimaryText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 6: SIGN OUT CONFIRMATION
         ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSignOutModal(false)}>
          <Pressable style={styles.modalDialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sign Out?</Text>
              <Pressable onPress={() => setShowSignOutModal(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={22} color="#94A3B8" />
              </Pressable>
            </View>

            <Text style={styles.signOutDialogText}>
              Are you sure you want to sign out of MeetHub on this device?
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowSignOutModal(false)}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirmSignOut()}
                style={[styles.modalBtn, styles.modalBtnDanger]}
              >
                <Text style={styles.modalBtnDangerText}>Sign Out</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },

  // User Profile Hero Card
  profileCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 38,
    fontWeight: '800',
    color: '#4F46E5',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  userEmail: {
    fontSize: 13,
    fontWeight: '500',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  metricItem: {
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  metricSub: {
    fontSize: 10,
    fontWeight: '500',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },

  // Settings Section
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  settingsBox: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  settingIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextWrap: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingSub: {
    fontSize: 12,
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    marginHorizontal: 16,
  },

  // Sign out button
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 18,
    paddingVertical: 15,
    marginTop: 8,
  },
  signOutBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
  },
  versionCaption: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 14,
    fontWeight: '500',
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  },
  modalErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  modalErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: 'white',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: '#4F46E5',
  },
  modalBtnPrimaryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBtnCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalBtnCancelText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBtnDanger: {
    backgroundColor: '#EF4444',
  },
  modalBtnDangerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },

  // Preferences Rows in Modal
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  preferenceTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  preferenceSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },

  // Privacy list
  privacyFeature: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  privacyTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  privacyDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  // About box
  aboutLogoBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  aboutAppName: {
    color: 'white',
    fontSize: 20,
    fontWeight: '800',
  },
  aboutVersion: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  aboutDesc: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },

  signOutDialogText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 14,
  },
});
