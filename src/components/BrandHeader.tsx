import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

interface BrandHeaderProps {
  compact?: boolean;
}

export function BrandHeader({ compact = false }: BrandHeaderProps) {
  const { colors, dark } = useAppTheme();

  return (
    <View style={styles.brandRow}>
      <View style={styles.brandLogoWrapper}>
        <View style={styles.brandLogoGlow} />
        <View style={styles.brandLogoBox}>
          <Image
            source={require('../../assets/images/meethub-logo.png')}
            style={styles.brandLogoImg}
            resizeMode="cover"
          />
          <View style={styles.brandLogoDot} />
        </View>
      </View>
      <View style={styles.brandTextGroup}>
        <View style={styles.brandTitleRow}>
          <Text style={[styles.brandTitle, { color: colors.text }]}>
            Meet<Text style={{ color: '#4F46E5' }}>Hub</Text>
          </Text>
          <View
            style={[
              styles.proBadge,
              {
                backgroundColor: dark
                  ? 'rgba(99, 102, 241, 0.22)'
                  : '#EEF2FF',
                borderColor: dark
                  ? 'rgba(99, 102, 241, 0.45)'
                  : 'rgba(99, 102, 241, 0.28)',
              },
            ]}
          >
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        </View>
        {!compact && (
          <Text style={[styles.brandTagline, { color: dark ? '#94A3B8' : '#64748B' }]}>
            Secure HD Video Network
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
    marginTop: 2,
  },
  brandLogoWrapper: {
    position: 'relative',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    opacity: 0.35,
    transform: [{ scale: 1.18 }],
  },
  brandLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  brandLogoImg: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
  },
  brandLogoDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  brandTextGroup: {
    gap: 2,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  proBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
  },
  proBadgeText: {
    color: '#4F46E5',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  brandTagline: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
