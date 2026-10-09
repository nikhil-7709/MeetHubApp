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
import { getFirebase } from '../firebase/config';

export function observeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebase().auth, callback);
}

export async function registerWithEmail(name: string, email: string, password: string) {
  const { auth, db } = getFirebase();
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
  const { auth } = getFirebase();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const { db } = getFirebase();
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
  const { auth, db } = getFirebase();
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
  const { auth } = getFirebase();
  return sendPasswordResetEmail(auth, email.trim());
}

export async function logout() {
  const { auth } = getFirebase();
  return signOut(auth);
}

export async function updateDisplayName(user: User, name: string) {
  const { db } = getFirebase();
  await updateProfile(user, { displayName: name.trim() });
  await setDoc(
    doc(db, 'users', user.uid),
    { userId: user.uid, name: name.trim(), email: user.email ?? '', profileImage: '' },
    { merge: true },
  );
}
