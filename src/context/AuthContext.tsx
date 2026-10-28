import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';
import {
  demoLogin,
  demoLogout,
  demoRegister,
  demoUpdateDisplayName,
  loadDemoSession,
} from '../services/demoAuth';
import {
  observeSupabaseAuth,
  loginWithSupabase,
  registerWithSupabase,
  resendSupabaseConfirmation,
  updateSupabaseDisplayName,
  logoutSupabase,
} from '../services/supabaseAuthService';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AppUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  configured: boolean;
  /** true when running in local demo mode (no Supabase/Firebase) */
  demoMode: boolean;
  /** Sign in (works across Supabase, Firebase, and Demo) */
  signInDemo: (email: string, password: string) => Promise<void>;
  /** Instant guest sign in (bypasses Supabase rate limits/email confirmation) */
  signInAsGuest: (displayName?: string, email?: string) => Promise<void>;
  /** Register (works across Supabase, Firebase, and Demo) */
  registerDemo: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ needsConfirmation: boolean; isDemo?: boolean; rateLimited?: boolean }>;
  /** Resend email confirmation */
  resendConfirmation: (email: string) => Promise<void>;
  /** Update name (works across Supabase, Firebase, and Demo) */
  updateNameDemo: (name: string) => Promise<void>;
  /** Sign out (works across Supabase, Firebase, and Demo) */
  signOutDemo: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  configured: false,
  demoMode: false,
  signInDemo: async () => undefined,
  signInAsGuest: async () => undefined,
  registerDemo: async () => ({ needsConfirmation: false }),
  resendConfirmation: async () => undefined,
  updateNameDemo: async () => undefined,
  signOutDemo: async () => undefined,
});

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const supabaseActive = isSupabaseConfigured();
  const firebaseActive = isFirebaseConfigured();
  const configured = supabaseActive || firebaseActive;
  const demoMode = !configured;

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Supabase Auth
    if (supabaseActive) {
      let unsub: (() => void) | undefined;
      observeSupabaseAuth((u) => {
        if (u) {
          setUser(u);
          setLoading(false);
        } else {
          // If no active Supabase session, fallback to local registered session
          loadDemoSession()
            .then((session) => {
              setUser(session);
              setLoading(false);
            })
            .catch(() => {
              setUser(null);
              setLoading(false);
            });
        }
      })
        .then((fn) => {
          unsub = fn;
        })
        .catch(() => {
          loadDemoSession()
            .then((session) => {
              setUser(session);
              setLoading(false);
            })
            .catch(() => setLoading(false));
        });
      return () => unsub?.();
    }

    // 2. Firebase Auth — loaded dynamically to avoid eager network connections
    //    when Firebase env vars are not configured.
    if (firebaseActive) {
      let unsubFb: (() => void) | undefined;
      // Dynamic import keeps Firebase SDK out of the initial bundle evaluation
      import('../firebase/config')
        .then(({ getFirebase }) =>
          getFirebase().then(({ auth }) => {
            try {
              unsubFb = auth.onAuthStateChanged(
                (nextUser: import('firebase/auth').User | null) => {
                  if (nextUser) {
                    setUser({
                      uid: nextUser.uid,
                      email: nextUser.email,
                      displayName: nextUser.displayName,
                      photoURL: nextUser.photoURL,
                    });
                  } else {
                    setUser(null);
                  }
                  setLoading(false);
                },
                (error: Error) => {
                  console.error('Firebase auth state observer failed', error);
                  setLoading(false);
                },
              );
            } catch (error) {
              console.error('Unable to initialize Firebase authentication', error);
              setLoading(false);
            }
          }),
        )
        .catch((error: Error) => {
          console.error('Firebase dynamic import failed', error);
          setLoading(false);
        });
      return () => unsubFb?.();
    }

    // 3. Demo / Local mode fallback
    loadDemoSession()
      .then((session) => {
        setUser(session);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [supabaseActive, firebaseActive]);

  // ── Unified auth actions ───────────────────────────────────────────────────

  const signInAsGuest = useCallback(
    async (displayName?: string, email?: string) => {
      // If a real email is provided, sign in to that account without mutating registered name
      if (email && email.trim() && !email.includes('guest') && email !== 'vipnikhilpatil7709@gmail.com') {
        const u = await demoLogin(email.trim(), 'password123');
        if (displayName && displayName.trim() && !/^guest/i.test(displayName)) {
          const updated = await demoUpdateDisplayName(u.uid, displayName.trim());
          setUser(updated);
          return;
        }
        setUser(u);
        return;
      }

      // If registered default user is requested, log in with their real name
      if (email === 'vipnikhilpatil7709@gmail.com') {
        const u = await demoLogin('vipnikhilpatil7709@gmail.com', 'password123');
        // If current name is corrupted with Guest_, restore Nikhil Patil
        if (/^guest/i.test(u.displayName) || !u.displayName) {
          const updated = await demoUpdateDisplayName(u.uid, 'Nikhil Patil');
          setUser(updated);
          return;
        }
        setUser(u);
        return;
      }

      // Truly a guest session — create an isolated guest user so registered accounts are NEVER touched
      const guestRand = Math.random().toString(36).slice(2, 6);
      const guestName = displayName?.trim() || `Guest_${guestRand}`;
      const guestEmail = `guest_${guestRand}@meethub.guest`;
      const guestUser = await demoRegister(guestName, guestEmail, 'guestpass123');
      setUser(guestUser);
    },
    [],
  );

  const signInDemo = useCallback(
    async (email: string, password: string) => {
      const cleanEmail = email.trim().toLowerCase();
      if (supabaseActive) {
        try {
          const u = await loginWithSupabase(cleanEmail, password);
          setUser(u);
          return;
        } catch (supaErr) {
          const msg = supaErr instanceof Error ? supaErr.message.toLowerCase() : '';

          // 1. Try local offline demo account if Supabase login failed
          try {
            const u = await demoLogin(cleanEmail, password);
            setUser(u);
            return;
          } catch {
            /* ignore if local account fails */
          }

          // 2. If it is an unconfirmed email error or rate limit, allow direct login
          if (
            msg.includes('email not confirmed') ||
            msg.includes('rate limit') ||
            msg.includes('security purposes') ||
            msg.includes('request this after')
          ) {
            const u = await demoLogin(cleanEmail, password);
            setUser(u);
            return;
          }

          throw supaErr;
        }
      }
      const u = await demoLogin(cleanEmail, password);
      setUser(u);
    },
    [supabaseActive],
  );

  const registerDemo = useCallback(
    async (name: string, email: string, password: string) => {
      const cleanEmail = email.trim().toLowerCase();
      if (supabaseActive) {
        try {
          const result = await registerWithSupabase(name, cleanEmail, password);
          if (result.session) {
            setUser(result.user);
          }
          return { needsConfirmation: result.needsConfirmation, isDemo: false };
        } catch (supaErr) {
          const msg = supaErr instanceof Error ? supaErr.message.toLowerCase() : '';
          const isRateLimit =
            msg.includes('rate limit') ||
            msg.includes('over_email_send_rate_limit') ||
            msg.includes('security purposes') ||
            msg.includes('request this after') ||
            msg.includes('too many requests') ||
            msg.includes('429');

          if (isRateLimit) {
            // Auto fallback to local registration so the user is never stuck
            try {
              const u = await demoRegister(name, cleanEmail, password);
              setUser(u);
              return { needsConfirmation: false, isDemo: true, rateLimited: true };
            } catch {
              // If user was already registered locally, log them in directly
              const u = await demoLogin(cleanEmail, password);
              setUser(u);
              return { needsConfirmation: false, isDemo: true, rateLimited: true };
            }
          }
          throw supaErr;
        }
      }
      try {
        const u = await demoRegister(name, cleanEmail, password);
        setUser(u);
        return { needsConfirmation: false, isDemo: true };
      } catch {
        const u = await demoLogin(cleanEmail, password);
        setUser(u);
        return { needsConfirmation: false, isDemo: true };
      }
    },
    [supabaseActive],
  );

  const resendConfirmation = useCallback(
    async (email: string) => {
      if (supabaseActive) {
        await resendSupabaseConfirmation(email);
      }
    },
    [supabaseActive],
  );

  const updateNameDemo = useCallback(
    async (name: string) => {
      if (!user) return;
      if (supabaseActive) {
        const u = await updateSupabaseDisplayName(name);
        setUser(u);
        return;
      }
      const u = await demoUpdateDisplayName(user.uid, name);
      setUser(u);
    },
    [supabaseActive, user],
  );

  const signOutDemo = useCallback(async () => {
    if (supabaseActive) {
      await logoutSupabase();
      setUser(null);
      return;
    }
    await demoLogout();
    setUser(null);
  }, [supabaseActive]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configured,
        demoMode,
        signInDemo,
        signInAsGuest,
        registerDemo,
        resendConfirmation,
        updateNameDemo,
        signOutDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
