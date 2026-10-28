import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  '';

export function isSupabaseConfigured(): boolean {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !/^(your[-_]|replace[-_])/i.test(supabaseUrl.trim()) &&
    !/^(your[-_]|replace[-_])/i.test(supabaseAnonKey.trim())
  );
}

const safeStorage = {
  getItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve(null);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
};

let _supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabaseInstance) return _supabaseInstance;

  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.',
    );
  }

  _supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: safeStorage,
      autoRefreshToken: Platform.OS !== 'web' || typeof window !== 'undefined',
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return _supabaseInstance;
}

export const supabase = isSupabaseConfigured()
  ? getSupabase()
  : (null as unknown as SupabaseClient);
