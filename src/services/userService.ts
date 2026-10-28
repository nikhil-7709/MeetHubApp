import { isSupabaseConfigured } from '../supabase/config';
import { isFirebaseConfigured, getFirebase } from '../firebase/config';
import { getSupabaseUserProfile } from './supabaseAuthService';
import type { UserProfile } from '../types';

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (isSupabaseConfigured()) {
    return getSupabaseUserProfile(userId);
  }

  if (isFirebaseConfigured()) {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await getFirebase();
    const snapshot = await getDoc(doc(db, 'users', userId));
    return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
  }

  return null;
}
