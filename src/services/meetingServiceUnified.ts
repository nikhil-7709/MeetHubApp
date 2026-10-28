/**
 * Unified Meeting Service
 * Primary backend: Supabase.
 * Fallback: Local demo storage (for guest/demo accounts or offline environments).
 * Firebase dependencies removed to prevent mixed backends.
 */
import { isSupabaseConfigured } from '../supabase/config';
import * as supabaseService from './supabaseMeetingService';
import * as demoService from './demoMeetings';
import type { Meeting } from '../types';

export type NewMeeting = Pick<
  Meeting,
  'title' | 'description' | 'hostId' | 'hostName' | 'scheduledDate' | 'startTime' | 'endTime'
> & { meetingId?: string };

export async function createMeeting(
  input: NewMeeting,
  status: Meeting['status'] = 'scheduled',
): Promise<Meeting> {
  if (isSupabaseConfigured()) {
    try {
      const created = await supabaseService.createMeeting(input, status);
      // Also cache in local demo service so user can view offline if needed
      await demoService.demoCreateMeeting(input, status).catch(() => {});
      return created;
    } catch (err) {
      console.warn('[MeetingService] Supabase createMeeting error, falling back to local demo storage:', err);
      return demoService.demoCreateMeeting(input, status);
    }
  }

  return demoService.demoCreateMeeting(input, status);
}

export async function getMeeting(meetingId: string): Promise<Meeting | null> {
  if (isSupabaseConfigured()) {
    try {
      const res = await supabaseService.getMeeting(meetingId);
      if (res) return res;
    } catch {
      /* fallback to demo storage */
    }
  }

  return demoService.demoGetMeeting(meetingId);
}

export async function joinMeeting(meetingId: string, userId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabaseService.joinMeeting(meetingId, userId);
      return;
    } catch {
      return demoService.demoJoinMeeting(meetingId, userId);
    }
  }

  return demoService.demoJoinMeeting(meetingId, userId);
}

export function subscribeToMyMeetings(
  userId: string,
  callback: (meetings: Meeting[]) => void,
  onError: (error: Error) => void,
): () => void {
  if (isSupabaseConfigured()) {
    return supabaseService.subscribeToMyMeetings(userId, callback, onError);
  }

  return demoService.demoSubscribeToMyMeetings(userId, callback, onError);
}

export async function endMeeting(meetingId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseService.endMeeting(meetingId);
    } catch {
      return demoService.demoEndMeeting(meetingId);
    }
  }

  return demoService.demoEndMeeting(meetingId);
}
