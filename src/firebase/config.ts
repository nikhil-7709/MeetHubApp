// isFirebaseConfigured() reads only env vars — no Firebase SDK import here,
// so importing this file never triggers Firebase network listeners.

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  // Treat the sample values in .env.example as unconfigured. Otherwise the app
  // attempts Firebase initialization with placeholder credentials and can get
  // stuck on the splash/login flow instead of showing the setup guidance.
  return Object.values(firebaseConfig).every(
    (value) =>
      typeof value === 'string' &&
      value.trim().length > 0 &&
      !/^(replace-with|your[-_.])/i.test(value.trim()),
  );
}

// All Firebase SDK imports are inside this function so they are never loaded
// unless Firebase is actually configured and this function is called.
export async function getFirebase() {
  const { FirebaseError, getApp, getApps, initializeApp } = await import('firebase/app');
  const { getAuth, getReactNativePersistence, initializeAuth } = await import('firebase/auth');
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const { getFirestore } = await import('firebase/firestore');

  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Add the EXPO_PUBLIC_FIREBASE_* values from your Firebase project to a local .env file.',
    );
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  let auth;
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if (!(error instanceof FirebaseError) || error.code !== 'auth/already-initialized') {
      throw error;
    }
    auth = getAuth(app);
  }

  return { app, auth, db: getFirestore(app) };
}

