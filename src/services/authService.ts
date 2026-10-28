import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';
import {
  loginWithSupabase,
  logoutSupabase,
  observeSupabaseAuth,
  registerWithSupabase,
  resendSupabaseConfirmation,
  resetSupabasePassword,
  updateSupabaseDisplayName,
  type AppAuthUser,
} from './supabaseAuthService';

export function observeAuth(callback: (user: User | AppAuthUser | null) => void) {
  if (isSupabaseConfigured()) {
    let unsub: (() => void) | undefined;
    observeSupabaseAuth((u) => callback(u)).then((fn) => {
      unsub = fn;
    });
    return () => unsub?.();
  }

  if (isFirebaseConfigured()) {
    // Dynamic import to prevent eager Firebase SDK loading
    let unsubFb: (() => void) | undefined;
    import('../firebase/config').then(({ getFirebase }) => {
      getFirebase().then(({ auth }) => {
        unsubFb = onAuthStateChanged(auth, callback as (u: User | null) => void);
      });
    });
    return () => unsubFb?.();
  }

  return () => {};
}

export async function registerWithEmail(name: string, email: string, password: string) {
  if (isSupabaseConfigured()) {
    const res = await registerWithSupabase(name, email, password);
    return res.user;
  }

  const { auth, db } = await (await import('../firebase/config')).getFirebase();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(credential.user, { displayName: name.trim() });
  await setDoc(doc(db, 'users', credential.user.uid), {
    userId: credential.user.uid,
    name: name.trim(),
    email: credential.user.email ?? email.trim(),
    profileImage: '',
    createdAt: Date.now(),
  });
  return credential.user;
}

export async function loginWithEmail(email: string, password: string) {
  if (isSupabaseConfigured()) {
    return loginWithSupabase(email, password);
  }

  const { auth, db } = await (await import('../firebase/config')).getFirebase();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const userRef = doc(db, 'users', credential.user.uid);
  const profile = await getDoc(userRef);
  if (!profile.exists()) {
    await setDoc(userRef, {
      userId: credential.user.uid,
      name: credential.user.displayName ?? 'MeetHub user',
      email: credential.user.email ?? email.trim(),
      profileImage: credential.user.photoURL ?? '',
      createdAt: Date.now(),
    });
  }
  return credential;
}

export async function loginWithGoogleIdToken(idToken: string) {
  const { auth, db } = await (await import('../firebase/config')).getFirebase();
  const credential = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  const userRef = doc(db, 'users', credential.user.uid);
  const current = await getDoc(userRef);
  if (!current.exists()) {
    await setDoc(userRef, {
      userId: credential.user.uid,
      name: credential.user.displayName ?? 'MeetHub user',
      email: credential.user.email ?? '',
      profileImage: credential.user.photoURL ?? '',
      createdAt: Date.now(),
    });
  }
  return credential.user;
}

export async function sendPasswordReset(email: string) {
  if (isSupabaseConfigured()) {
    return resetSupabasePassword(email.trim());
  }
  const { auth } = await (await import('../firebase/config')).getFirebase();
  return sendPasswordResetEmail(auth, email.trim());
}

export async function logout() {
  if (isSupabaseConfigured()) {
    return logoutSupabase();
  }
  const { auth } = await (await import('../firebase/config')).getFirebase();
  return signOut(auth);
}

export async function updateDisplayName(user: User | { uid: string }, name: string) {
  if (isSupabaseConfigured()) {
    return updateSupabaseDisplayName(name);
  }
  const { db } = await (await import('../firebase/config')).getFirebase();
  await updateProfile(user as User, { displayName: name.trim() });
  await setDoc(
    doc(db, 'users', user.uid),
    { userId: user.uid, name: name.trim(), email: (user as User).email ?? '', profileImage: '' },
    { merge: true },
  );
}

export async function resendConfirmationEmail(email: string) {
  if (isSupabaseConfigured()) {
    return resendSupabaseConfirmation(email);
  }
}


