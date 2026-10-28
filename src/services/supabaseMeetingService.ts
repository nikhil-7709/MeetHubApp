import { getSupabase } from '../supabase/config';
import type { Meeting, MeetingStatus } from '../types';

export interface CreateMeetingInput {
  meetingId?: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  scheduledDate: number;
  startTime: number;
  endTime: number;
}

export function generateMeetingId(): string {
  const p1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const p2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MH-${p1}-${p2}`;
}

// Convert Supabase DB row (snake_case) to app Meeting model (camelCase)
function mapRowToMeeting(row: Record<string, unknown>): Meeting {
  return {
    meetingId: String(row.meeting_id || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    hostId: String(row.host_id || ''),
    hostName: String(row.host_name || ''),
    scheduledDate: Number(row.scheduled_date || 0),
    startTime: Number(row.start_time || 0),
    endTime: Number(row.end_time || 0),
    participants: Array.isArray(row.participants) ? (row.participants as string[]) : [],
    createdAt: Number(row.created_at || Date.now()),
    startedAt: row.started_at ? Number(row.started_at) : undefined,
    endedAt: row.ended_at ? Number(row.ended_at) : undefined,
    durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : undefined,
    status: (row.status as MeetingStatus) || 'scheduled',
  };
}

export async function createMeeting(
  input: CreateMeetingInput,
  status: MeetingStatus = 'scheduled',
): Promise<Meeting> {
  const supabase = getSupabase();
  const meetingId = (input.meetingId || generateMeetingId()).trim().toUpperCase();
  const now = Date.now();

  const newMeeting: Meeting = {
    meetingId,
    title: input.title.trim() || 'Live Meeting',
    description: (input.description ?? '').trim(),
    hostId: input.hostId,
    hostName: input.hostName,
    scheduledDate: input.scheduledDate || now,
    startTime: input.startTime || now,
    endTime: input.endTime || now + 2 * 60 * 60 * 1000,
    participants: [input.hostId],
    createdAt: now,
    status,
    startedAt: status === 'active' ? now : undefined,
  };

  const { error } = await supabase.from('meetings').insert({
    meeting_id: newMeeting.meetingId,
    title: newMeeting.title,
    description: newMeeting.description,
    host_id: newMeeting.hostId,
    host_name: newMeeting.hostName,
    scheduled_date: newMeeting.scheduledDate,
    start_time: newMeeting.startTime,
    end_time: newMeeting.endTime,
    participants: newMeeting.participants,
    created_at: newMeeting.createdAt,
    started_at: newMeeting.startedAt,
    status: newMeeting.status,
  });

  if (error) throw error;
  return newMeeting;
}

export async function getMeeting(meetingId: string): Promise<Meeting | null> {
  const supabase = getSupabase();
  const cleanId = (meetingId || '').trim().toUpperCase();
  if (!cleanId) return null;

  // 1. Try exact match first
  let { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('meeting_id', cleanId)
    .maybeSingle();

  // 2. If not found and input omitted the "MH-" prefix, retry with prefix
  if (!data && !cleanId.startsWith('MH-')) {
    const withPrefix = `MH-${cleanId}`;
    const res = await supabase
      .from('meetings')
      .select('*')
      .eq('meeting_id', withPrefix)
      .maybeSingle();
    data = res.data;
  }

  // 3. Fallback to case-insensitive match
  if (!data) {
    const res = await supabase
      .from('meetings')
      .select('*')
      .ilike('meeting_id', cleanId)
      .maybeSingle();
    data = res.data;
  }

  if (error && !data) return null;
  if (!data) return null;

  return mapRowToMeeting(data);
}

export async function joinMeeting(meetingId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  const current = await getMeeting(meetingId);
  if (!current) throw new Error('Meeting not found.');

  const currentParticipants = current.participants || [];
  if (!currentParticipants.includes(userId)) {
    const updated = [...currentParticipants, userId];
    const { error } = await supabase
      .from('meetings')
      .update({ participants: updated })
      .eq('meeting_id', current.meetingId);

    if (error) throw error;
  }
}

export async function endMeeting(meetingId: string): Promise<void> {
  const supabase = getSupabase();
  const current = await getMeeting(meetingId);
  if (!current) return;

  const now = Date.now();
  const durationSeconds = current.startedAt
    ? Math.max(0, Math.round((now - current.startedAt) / 1000))
    : 0;

  const { error } = await supabase
    .from('meetings')
    .update({
      status: 'ended',
      ended_at: now,
      duration_seconds: durationSeconds,
    })
    .eq('meeting_id', current.meetingId);

  if (error) throw error;
}

export function subscribeToMyMeetings(
  userId: string,
  callback: (meetings: Meeting[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const supabase = getSupabase();
  let isSubscribed = true;

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .or(`host_id.eq.${userId},participants.cs.{${userId}}`)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      if (!isSubscribed) return;
      const list = (data || []).map(mapRowToMeeting);
      callback(list);
    } catch (err) {
      if (!isSubscribed) return;
      onError?.(err instanceof Error ? err : new Error('Failed to fetch meetings'));
    }
  };

  void fetchMeetings();

  const channelName = `meetings:${userId}:${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'meetings' },
      () => {
        void fetchMeetings();
      },
    )
    .subscribe();

  return () => {
    isSubscribed = false;
    void supabase.removeChannel(channel);
  };
}
