import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import WelcomeScreen from './(auth)/welcome';

export default function IndexPage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // If user is already authenticated, direct them straight to the main app dashboard
    if (!loading && user) {
      router.replace('/(tabs)');
    }
  }, [loading, user]);

  // Starts directly on the Welcome page on Vercel and root path
  return <WelcomeScreen />;
}
