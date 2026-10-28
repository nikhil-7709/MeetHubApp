-- ============================================================================
-- MeetHub: Complete Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================================

-- ============================================================================
-- 1. PROFILES TABLE (Extends Supabase auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  profile_image TEXT DEFAULT '',
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. MEETINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meetings (
  meeting_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  scheduled_date BIGINT NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  participants TEXT[] DEFAULT '{}',
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  started_at BIGINT,
  ended_at BIGINT,
  duration_seconds INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'ended'))
);

-- ============================================================================
-- 3. MEETING PARTICIPANTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id TEXT NOT NULL REFERENCES public.meetings(meeting_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. MEETING MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meeting_messages (
  message_id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES public.meetings(meeting_id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- ============================================================================
-- INDEXES FOR HIGH QUERY PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_meetings_host_id     ON public.meetings(host_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status      ON public.meetings(status);
CREATE INDEX IF NOT EXISTS idx_meeting_msgs_meeting ON public.meeting_messages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_msgs_ts      ON public.meeting_messages(timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_mp_meeting_id        ON public.meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_mp_user_id           ON public.meeting_participants(user_id);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_messages     ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert"
  ON public.profiles FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE TO authenticated, anon USING (true);

-- ============================================================================
-- MEETINGS POLICIES (Allow authenticated and guest participants to view/create/join)
-- ============================================================================
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
CREATE POLICY "meetings_select"
  ON public.meetings FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
CREATE POLICY "meetings_insert"
  ON public.meetings FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
CREATE POLICY "meetings_update"
  ON public.meetings FOR UPDATE TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;
CREATE POLICY "meetings_delete"
  ON public.meetings FOR DELETE TO authenticated, anon
  USING (host_id = auth.uid()::TEXT OR auth.uid() IS NULL);

-- ============================================================================
-- MEETING PARTICIPANTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "mp_select" ON public.meeting_participants;
CREATE POLICY "mp_select"
  ON public.meeting_participants FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "mp_insert" ON public.meeting_participants;
CREATE POLICY "mp_insert"
  ON public.meeting_participants FOR INSERT TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "mp_delete" ON public.meeting_participants;
CREATE POLICY "mp_delete"
  ON public.meeting_participants FOR DELETE TO authenticated, anon
  USING (true);

-- ============================================================================
-- MEETING MESSAGES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "msgs_select" ON public.meeting_messages;
CREATE POLICY "msgs_select"
  ON public.meeting_messages FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "msgs_insert" ON public.meeting_messages;
CREATE POLICY "msgs_insert"
  ON public.meeting_messages FOR INSERT TO authenticated, anon
  WITH CHECK (length(message) > 0);

-- ============================================================================
-- ENABLE REALTIME (idempotent publication setup)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'meetings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'meeting_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_messages;
  END IF;
END $$;

-- ============================================================================
-- AUTO-CREATE PROFILE ON SIGN-UP TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, profile_image, created_at)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
