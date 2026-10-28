/**
 * Meeting Chat Service
 * Supports Supabase Realtime (primary) with local memory fallback for demo/guest users.
 * Firebase dependencies removed to prevent mixed backends.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured } from '../supabase/config';
import * as supabaseChat from './supabaseChatService';
import type { MeetingMessage } from '../types';

// In-memory cache for fast renders
const memoryCache = new Map<string, MeetingMessage[]>();

// Subscribers for demo mode
const subscribers = new Map<string, Set<(messages: MeetingMessage[]) => void>>();

// ── Demo mode fallback implementation ─────────────────────────────────────────

function demoSubscribeToMessages(
  meetingId: string,
  callback: (messages: MeetingMessage[]) => void,
): () => void {
  let set = subscribers.get(meetingId);
  if (!set) {
    set = new Set();
    subscribers.set(meetingId, set);
  }
  set.add(callback);

  const cached = memoryCache.get(meetingId);
  if (cached) {
    callback(cached);
  } else {
    AsyncStorage.getItem(`meethub:chat:${meetingId}`)
      .then((raw) => {
        const msgs: MeetingMessage[] = raw ? JSON.parse(raw) : [];
        memoryCache.set(meetingId, msgs);
        callback(msgs);
      })
      .catch(() => callback([]));
  }

  return () => {
    subscribers.get(meetingId)?.delete(callback);
  };
}

async function demoSendMessage(
  meetingId: string,
  senderId: string,
  senderName: string,
  message: string,
): Promise<void> {
  const newMsg: MeetingMessage = {
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    meetingId,
    senderId,
    senderName,
    message: message.trim(),
    timestamp: Date.now(),
  };

  const arr = memoryCache.get(meetingId) ?? [];
  arr.push(newMsg);
  memoryCache.set(meetingId, arr);

  const subs = subscribers.get(meetingId);
  if (subs) {
    subs.forEach((cb) => {
      try {
        cb([...arr]);
      } catch {
        /* ignore */
      }
    });
  }

  AsyncStorage.setItem(`meethub:chat:${meetingId}`, JSON.stringify(arr)).catch(() => null);
}

// ── Unified API ───────────────────────────────────────────────────────────────

export function subscribeToMeetingMessages(
  meetingId: string,
  callback: (messages: MeetingMessage[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isSupabaseConfigured()) {
    try {
      return supabaseChat.subscribeToMeetingMessages(meetingId, callback);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Failed to subscribe to chat'));
      return demoSubscribeToMessages(meetingId, callback);
    }
  }

  return demoSubscribeToMessages(meetingId, callback);
}

export async function sendMeetingMessage(
  meetingId: string,
  senderId: string,
  senderName: string,
  message: string,
): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabaseChat.sendMeetingMessage(meetingId, senderId, senderName, message);
      return;
    } catch {
      // If table write fails due to RLS, save to demo/memory cache so chat doesn't drop
      return demoSendMessage(meetingId, senderId, senderName, message);
    }
  }

  return demoSendMessage(meetingId, senderId, senderName, message);
}
