import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';

export default function SplashScreen() {
  const { user, loading, configured } = useAuth();
  const { colors } = useAppTheme();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [fade]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => router.replace(user ? '/(tabs)' : '/(auth)/login'), 550);
      return () => clearTimeout(timer);
    }
  }, [loading, user]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.brand, { opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}><MaterialCommunityIcons name="video-outline" size={36} color="white" /></View>
        <Text style={[styles.name, { color: colors.text }]}>Meet<Text style={{ color: colors.primary }}>Hub</Text></Text>
        <Text style={[styles.tagline, { color: colors.muted }]}>{configured ? 'Make space for better meetings' : 'Ready when your team is'}</Text>
      </Animated.View>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 42 },
  brand: { alignItems: 'center', gap: 13 },
  logo: { width: 76, height: 76, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 33, fontWeight: '800', letterSpacing: -1 },
  tagline: { fontSize: 14 },
});
