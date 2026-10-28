import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProvider, useAppTheme } from '../src/context/ThemeContext';
export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppNavigator() {
  const { dark, colors } = useAppTheme();
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const segs = segments as string[];
    const isAuthRoute =
      segs.includes('(auth)') ||
      segs.includes('login') ||
      segs.includes('register') ||
      segs.includes('welcome') ||
      segs[0] === 'login' ||
      segs[0] === 'register' ||
      segs[0] === 'welcome';
    const isMeetingRoute = segs.includes('meeting') || segs[0] === 'meeting';

    if (!user && !isAuthRoute && segs[0] !== 'index' && !isMeetingRoute) {
      router.replace('/(auth)/welcome');
    } else if (user && isAuthRoute) {
      router.replace('/(tabs)');
    }
  }, [loading, router, segments, user]);

  return (
    <NavigationThemeProvider value={dark ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, primary: colors.primary, text: colors.text, border: colors.border } } : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface, primary: colors.primary, text: colors.text, border: colors.border } }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="create-meeting" options={{ presentation: 'modal', title: 'New meeting' }} />
        <Stack.Screen name="schedule" options={{ presentation: 'modal', title: 'Schedule meeting' }} />
        <Stack.Screen name="meeting/[meetingId]" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      <StatusBar style={dark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

