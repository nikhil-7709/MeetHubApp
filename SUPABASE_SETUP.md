# MeetHub — Supabase Setup Guide

> Complete setup walkthrough for connecting MeetHub to your Supabase project.  
> Project URL: `https://peyressohpsbazcznmhn.supabase.co`

---

## Step 1 — Add your anon key to `.env`

1. Go to [Supabase Dashboard → Project Settings → API](https://supabase.com/dashboard/project/peyressohpsbazcznmhn/settings/api)
2. Under **Project API keys**, copy the **`anon` `public`** key (starts with `eyJ...`)
3. Open `.env` in the project root and replace the placeholder:

```diff
- EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
+ EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...  ← paste your real key here
```

> ⚠️ **Never** use the `service_role` key in the app. That key bypasses all Row Level
> Security and must only ever be used in server-side code.

---

## Step 2 — Enable Email/Password Authentication

1. Go to **Authentication → Providers → Email**
2. Make sure **Enable Email provider** is toggled **ON**
3. (Optional) If you want users to be able to sign in immediately without confirming their
   email, disable **Confirm email** under the same section.  
   *(Recommended for development; turn it back on for production.)*

---

## Step 3 — Run the Database Schema

1. Go to **SQL Editor** in the Supabase Dashboard
2. Click **New query**
3. Paste the entire contents of `supabase_schema.sql` (in the project root) and click **Run**

This creates:

| Table | Purpose |
|---|---|
| `public.profiles` | One row per user — synced from `auth.users` via trigger |
| `public.meetings` | Meeting rooms (TEXT[] participants for backward-compat) |
| `public.meeting_participants` | Normalized UUID join table for RLS-safe queries |
| `public.meeting_messages` | In-meeting chat messages |

Also created automatically:
- All indexes for query performance
- Row Level Security (RLS) on every table
- Realtime enabled for `meetings` and `meeting_messages`
- `handle_new_user` trigger that auto-creates a `profiles` row on every new sign-up

---

## Step 4 — Verify RLS Policies

After running the schema, confirm the policies exist:  
Go to **Authentication → Policies** (or **Table Editor → [table] → RLS**)

### `profiles`
- `profiles_select` — any authenticated user can read any profile
- `profiles_insert` — users can only insert their own profile (`auth.uid() = id`)
- `profiles_update` — users can only update their own profile

### `meetings`
- `meetings_select` — any authenticated user can read meetings
- `meetings_insert` — any authenticated user can create a meeting
- `meetings_update` — any authenticated user can update a meeting (host check is app-level)
- `meetings_delete` — only the host can delete (`host_id = auth.uid()::TEXT`)

### `meeting_participants`
- `mp_select` — any authenticated user can read participants
- `mp_insert` — users can only add themselves (`user_id = auth.uid()`)
- `mp_delete` — users can only remove themselves

### `meeting_messages`
- `msgs_select` — any authenticated user can read messages
- `msgs_insert` — users can only send as themselves (`sender_id = auth.uid()::TEXT`)

---

## Step 5 — Enable Realtime

The schema SQL handles this, but verify:
1. Go to **Database → Replication**
2. Under **supabase_realtime**, confirm `meetings` and `meeting_messages` are in the list

---

## Step 6 — Test the Connection

After adding the anon key, start the dev server:

```powershell
npx expo start
```

Test these flows:

- [ ] **Register** a new account → check that a row appears in `auth.users` and `profiles`
- [ ] **Login** with the registered account → navigates to home screen
- [ ] **Logout** → returns to welcome/login screen
- [ ] **Session persistence** — kill and reopen the app → should stay logged in
- [ ] **Create a meeting** → row appears in `meetings` table
- [ ] **Join a meeting** → `participants` array is updated

---

## How the App Selects a Backend

```
Supabase configured?  → Use Supabase Auth + Supabase DB
Firebase configured?  → Use Firebase Auth + Firestore
Neither?              → Local demo mode (no persistence)
```

`isSupabaseConfigured()` returns `true` only when both env vars are non-placeholder values.
Once you set the real anon key, Supabase becomes the active backend automatically.

---

## Key Files

| File | Role |
|---|---|
| `src/supabase/config.ts` | Singleton Supabase client with AsyncStorage session persistence |
| `src/services/supabaseAuthService.ts` | Register, login, logout, session observer, profile CRUD |
| `src/services/supabaseMeetingService.ts` | Meeting CRUD + realtime subscription |
| `src/services/supabaseChatService.ts` | Chat messages + realtime |
| `src/context/AuthContext.tsx` | Auth state provider — wraps all three backends |
| `src/services/meetingServiceUnified.ts` | Unified facade that routes to the active backend |
| `supabase_schema.sql` | Full DB schema, RLS policies, trigger, realtime |
| `.env` | Local env vars — **never commit this file** |

---

## Troubleshooting

**"Supabase is not configured" error**  
→ The anon key in `.env` is still a placeholder. Replace it with the real `eyJ...` key.

**Auth works but meetings table is empty / permission denied**  
→ The schema SQL hasn't been run yet. Complete Step 3.

**"new row violates row-level security policy" on profiles insert**  
→ The `handle_new_user` trigger handles profile creation automatically. The app upsert uses
`ignoreDuplicates: true` so duplicate-key errors are silently skipped.

**Session not persisted after app restart**  
→ The Supabase client is configured with `storage: AsyncStorage` and `persistSession: true`
in `src/supabase/config.ts`. Ensure `@react-native-async-storage/async-storage` is installed.

**Realtime not working**  
→ Verify that Realtime is enabled for the project (Database → Replication) and that
`supabase_realtime` includes both `meetings` and `meeting_messages`.

---

## Security Notes

- The **anon key** is safe in the app — RLS policies enforce per-user access.
- The **service_role key** bypasses all RLS and **must never** be in the app.
- `.env` is in `.gitignore` and must never be committed to source control.
