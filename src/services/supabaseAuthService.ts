import { getSupabase } from '../supabase/config';
import type { UserProfile } from '../types';

export interface AppAuthUser {
  uid: string;
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
}

export function formatSupabaseUser(user: {
  id: string;
  email?: string;
  user_metadata?: { name?: string; full_name?: string; avatar_url?: string };
} | null): AppAuthUser | null {
  if (!user) return null;
  const name =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    (user.email ? user.email.split('@')[0] : 'User');
  return {
    uid: user.id,
    id: user.id,
    email: user.email,
    displayName: name,
    photoURL: user.user_metadata?.avatar_url ?? '',
  };
}

export async function observeSupabaseAuth(
  callback: (user: AppAuthUser | null) => void,
): Promise<() => void> {
  const supabase = getSupabase();

  // Deliver persisted session immediately so the app doesn't flash the login screen
  const { data: sessionData } = await supabase.auth.getSession();
  callback(formatSupabaseUser(sessionData.session?.user ?? null));

  // Listen to all future auth state changes (sign-in, sign-out, token refresh)
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(formatSupabaseUser(session?.user ?? null));
  });

  return () => {
    listener.subscription.unsubscribe();
  };
}

export interface SupabaseRegisterResult {
  user: AppAuthUser;
  needsConfirmation: boolean;
  session: unknown;
}

export async function registerWithSupabase(
  name: string,
  email: string,
  password: string,
): Promise<SupabaseRegisterResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        name: name.trim(),
        full_name: name.trim(),
      },
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error('Registration failed — no user returned from Supabase.');

  // The DB trigger (handle_new_user) automatically creates the profiles row on INSERT to
  // auth.users. The upsert here is a belt-and-suspenders fallback in case the trigger
  // hasn't run yet (e.g. on the same transaction). It is safe to ignore conflicts.
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: data.user.id,
      name: name.trim(),
      email: data.user.email ?? email.trim(),
      profile_image: '',
      created_at: Date.now(),
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );

  if (profileError && profileError.code !== '23505' /* duplicate key */) {
    // Non-fatal: the DB trigger will handle profile creation; log but don't block.
    console.warn('[Supabase] Profile upsert skipped:', profileError.message);
  }

  const formatted = formatSupabaseUser(data.user);
  if (!formatted) throw new Error('Could not format user');

  return {
    user: formatted,
    needsConfirmation: !data.session,
    session: data.session,
  };
}

export async function resendSupabaseConfirmation(email: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
  });
  if (error) throw error;
}

export async function loginWithSupabase(email: string, password: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error('Sign in failed — no user returned from Supabase.');

  return formatSupabaseUser(data.user);
}

export async function logoutSupabase() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateSupabaseDisplayName(name: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.updateUser({
    data: { name: name.trim(), full_name: name.trim() },
  });

  if (error) throw error;

  if (data.user) {
    // Best-effort: update denormalized name in the profiles table
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ name: name.trim() })
      .eq('id', data.user.id);

    if (profileErr) {
      console.warn('[Supabase] Profile name sync failed:', profileErr.message);
    }
  }

  return formatSupabaseUser(data.user);
}

export async function resetSupabasePassword(email: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) throw error;
}

export async function getSupabaseUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    userId: data.id,
    name: data.name,
    email: data.email,
    profileImage: data.profile_image ?? '',
    createdAt: Number(data.created_at || Date.now()),
  };
}
