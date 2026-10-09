import type { User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getFirebase, isFirebaseConfigured } from '../firebase/config';

type AuthContextValue = { user: User | null; loading: boolean; configured: boolean };
const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, configured: false });

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    try {
      return getFirebase().auth.onAuthStateChanged((nextUser) => {
        setUser(nextUser);
        setLoading(false);
      }, (error) => {
        console.error('Firebase auth state observer failed', error);
        setLoading(false);
      });
    } catch (error) {
      console.error('Unable to initialize Firebase authentication', error);
      setLoading(false);
    }
  }, [configured]);

  return <AuthContext.Provider value={{ user, loading, configured }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
