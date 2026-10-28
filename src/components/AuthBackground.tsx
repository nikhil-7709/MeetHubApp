import React from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

interface AuthBackgroundProps {
  children?: React.ReactNode;
  showThemeToggle?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function AuthBackground({ children, showThemeToggle = true }: AuthBackgroundProps) {
  const { dark, toggle } = useAppTheme();

  return (
    <View
      style={[
        styles.rootContainer,
        { backgroundColor: dark ? '#080B16' : '#F6F8FC' },
      ]}
    >
      {/* ── AMBIENT LUMINOUS GLOW ORBS ────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {/* Top-Right Indigo Glow Cluster */}
        <View
          style={[
            styles.glowOrb,
            {
              top: -80,
              right: -60,
              width: 400,
              height: 400,
              borderRadius: 200,
              backgroundColor: dark
                ? 'rgba(79, 70, 229, 0.32)'
                : 'rgba(99, 102, 241, 0.16)',
            },
          ]}
        />
        <View
          style={[
            styles.glowOrb,
            {
              top: -20,
              right: 10,
              width: 260,
              height: 260,
              borderRadius: 130,
              backgroundColor: dark
                ? 'rgba(124, 58, 237, 0.38)'
                : 'rgba(139, 92, 246, 0.20)',
            },
          ]}
        />
        <View
          style={[
            styles.glowOrb,
            {
              top: 40,
              right: 60,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: dark
                ? 'rgba(168, 85, 247, 0.45)'
                : 'rgba(192, 132, 252, 0.24)',
            },
          ]}
        />

        {/* Top-Left Cyan Glow */}
        <View
          style={[
            styles.glowOrb,
            {
              top: 40,
              left: -100,
              width: 320,
              height: 320,
              borderRadius: 160,
              backgroundColor: dark
                ? 'rgba(6, 182, 212, 0.16)'
                : 'rgba(56, 189, 248, 0.22)',
            },
          ]}
        />
        <View
          style={[
            styles.glowOrb,
            {
              top: 100,
              left: -30,
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: dark
                ? 'rgba(14, 165, 233, 0.22)'
                : 'rgba(125, 211, 252, 0.28)',
            },
          ]}
        />

        {/* Bottom Ambient Purple Halo */}
        <View
          style={[
            styles.glowOrb,
            {
              bottom: -110,
              left: SCREEN_WIDTH * 0.15,
              width: 360,
              height: 360,
              borderRadius: 180,
              backgroundColor: dark
                ? 'rgba(99, 102, 241, 0.20)'
                : 'rgba(167, 139, 250, 0.20)',
            },
          ]}
        />

        {/* Decorative Grid Lines / Rings (Modern Tech Aesthetic) */}
        <View
          style={[
            styles.ambientRing,
            {
              top: -60,
              right: -60,
              width: 320,
              height: 320,
              borderRadius: 160,
              borderColor: dark
                ? 'rgba(99, 102, 241, 0.18)'
                : 'rgba(99, 102, 241, 0.12)',
            },
          ]}
        />
        <View
          style={[
            styles.ambientRing,
            {
              top: 10,
              right: 10,
              width: 180,
              height: 180,
              borderRadius: 90,
              borderColor: dark
                ? 'rgba(168, 85, 247, 0.22)'
                : 'rgba(168, 85, 247, 0.15)',
            },
          ]}
        />

        {/* Floating Ambient Sparkle Badges */}
        <View
          style={[
            styles.ambientTechBadge,
            {
              top: 26,
              left: 20,
              backgroundColor: dark
                ? 'rgba(30, 41, 59, 0.65)'
                : 'rgba(255, 255, 255, 0.85)',
              borderColor: dark
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(99, 102, 241, 0.2)',
            },
          ]}
        >
          <View style={styles.pulseDot} />
          <Text
            style={[
              styles.ambientTechText,
              { color: dark ? '#CBD5E1' : '#475569' },
            ]}
          >
            HD Video Network
          </Text>
        </View>
      </View>

      {/* ── TOP FLOATING THEME TOGGLE ────────────────────────────────────────── */}
      {showThemeToggle && (
        <View style={styles.topRightControls}>
          <Pressable
            onPress={toggle}
            style={({ pressed }) => [
              styles.themeToggleBtn,
              {
                backgroundColor: dark
                  ? 'rgba(30, 41, 59, 0.75)'
                  : 'rgba(255, 255, 255, 0.9)',
                borderColor: dark
                  ? 'rgba(255, 255, 255, 0.14)'
                  : 'rgba(0, 0, 0, 0.08)',
              },
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
            hitSlop={8}
            accessibilityLabel="Toggle Theme"
          >
            <MaterialCommunityIcons
              name={dark ? 'weather-sunny' : 'weather-night'}
              size={18}
              color={dark ? '#FBBF24' : '#6366F1'}
            />
          </Pressable>
        </View>
      )}

      {/* Inner Screen Content */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    position: 'relative',
  },
  glowOrb: {
    position: 'absolute',
    ...Platform.select({
      web: {
        filter: 'blur(60px)',
      },
      default: {
        opacity: 0.8,
      },
    }),
  },
  ambientRing: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  ambientTechBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  ambientTechText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  topRightControls: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    right: 20,
    zIndex: 50,
  },
  themeToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
});
