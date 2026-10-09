import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '../firebase/config';
import type { UserProfile } from '../types';

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { db } = getFirebase();
  const snapshot = await getDoc(doc(db, 'users', userId));
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}
