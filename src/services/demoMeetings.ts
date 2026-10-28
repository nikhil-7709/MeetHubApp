/**
 * Demo meeting service — fully in-memory with AsyncStorage persistence.
 * Drop-in replacement for Firebase meetingService when not configured.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Meeting } from '../types';

const MEETINGS_KEY = 'meethub:demo:meetings';

// ── subscribers ──────────────────────────────────────────────────────────────
type Subscriber = (meetings: Meeting[]) => void;
const subscribers = new Map<string, Subscriber[]>(); // keyed by userId

let cachedMeetings: Meeting[] | null = null;

async function loadMeetings(): Promise<Meeting[]> {
  if (cachedMeetings !== null) return cachedMeetings;
  try {
    const raw = await AsyncStorage.getItem(MEETINGS_KEY);
    cachedMeetings = raw ? (JSON.parse(raw) as Meeting[]) : seedDemoMeetings();
  } catch {
    cachedMeetings = seedDemoMeetings();
  }
  return cachedMeetings;
}

async function saveMeetings(meetings: Meeting[]) {
  cachedMeetings = meetings;
  await AsyncStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
  // notify all subscribers
  subscribers.forEach((subs, userId) => {
    const mine = meetings.filter((m) => m.participants.includes(userId));
    subs.forEach((cb) => cb(mine));
  });
}

function seedDemoMeetings(): Meeting[] {
  const now = Date.now();
  return [
    {
      meetingId: 'MH-DEMO-001',
      title: 'Weekly Team Sync',
      description: 'Catch up on progress and blockers.',
      hostId: 'demo-seed',
      hostName: 'Alex Demo',
      participants: ['demo-seed'],
      scheduledDate: now,
      startTime: now + 30 * 60 * 1000,
      endTime: now + 90 * 60 * 1000,
      createdAt: now - 60 * 60 * 1000,
      status: 'scheduled',
    },
    {
      meetingId: 'MH-DEMO-002',
      title: 'Product Review',
      description: 'Review designs for the new feature.',
      hostId: 'demo-seed',
      hostName: 'Alex Demo',
      participants: ['demo-seed'],
      scheduledDate: now + 24 * 60 * 60 * 1000,
      startTime: now + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
      endTime: now + 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000,
      createdAt: now - 2 * 60 * 60 * 1000,
      status: 'scheduled',
    },
  ];
}

function makeMeetingId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const part = (size: number) =>
    Array.from({ length: size }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `MH-${part(4)}-${part(3)}`;
}

// ── Public API (mirrors Firebase meetingService) ──────────────────────────────

export async function demoCreateMeeting(
  input: Pick<Meeting, 'title' | 'description' | 'hostId' | 'hostName' | 'scheduledDate' | 'startTime' | 'endTime'>,
  status: Meeting['status'] = 'scheduled',
): Promise<Meeting> {
  const meetings = await loadMeetings();
  const meeting: Meeting = {
    ...input,
    meetingId: makeMeetingId(),
    participants: [input.hostId],
    createdAt: Date.now(),
    ...(status === 'active' ? { startedAt: Date.now() } : {}),
    status,
  };
  await saveMeetings([...meetings, meeting]);
  return meeting;
}

export async function demoGetMeeting(meetingId: string): Promise<Meeting | null> {
  const meetings = await loadMeetings();
  const normalized = meetingId.trim().toUpperCase();
  const existing = meetings.find((m) => m.meetingId === normalized);
  if (existing) return existing;

  // Cross-device demo mode support: if code looks valid (e.g. MH-... or any 3+ chars),
  // dynamically register the room so another device can join via signaling server!
  if (normalized.length >= 3) {
    const adHoc: Meeting = {
      meetingId: normalized,
      title: `Meeting ${normalized}`,
      description: 'Instant meeting room',
      hostId: 'remote-host',
      hostName: 'Host',
      participants: ['remote-host'],
      scheduledDate: Date.now(),
      startTime: Date.now(),
      endTime: Date.now() + 4 * 60 * 60 * 1000,
      createdAt: Date.now(),
      status: 'active',
    };
    await saveMeetings([...meetings, adHoc]);
    return adHoc;
  }
  return null;
}

export async function demoJoinMeeting(meetingId: string, userId: string): Promise<void> {
  const meetings = await loadMeetings();
  const normalized = meetingId.trim().toUpperCase();
  const idx = meetings.findIndex((m) => m.meetingId === normalized);
  if (idx === -1) {
    // Cross-device ad-hoc room join
    const newMeeting: Meeting = {
      meetingId: normalized,
      title: `Meeting ${normalized}`,
      description: 'Instant meeting room',
      hostId: 'remote-host',
      hostName: 'Host',
      participants: ['remote-host', userId],
      scheduledDate: Date.now(),
      startTime: Date.now(),
      endTime: Date.now() + 4 * 60 * 60 * 1000,
      createdAt: Date.now(),
      status: 'active',
    };
    await saveMeetings([...meetings, newMeeting]);
    return;
  }
  if (meetings[idx].status === 'ended') throw new Error('This meeting has ended.');
  const updated = { ...meetings[idx] };
  if (!updated.participants.includes(userId)) updated.participants = [...updated.participants, userId];
  if (updated.status !== 'active') { updated.status = 'active'; (updated as Meeting & { startedAt?: number }).startedAt = Date.now(); }
  meetings[idx] = updated;
  await saveMeetings([...meetings]);
}

export function demoSubscribeToMyMeetings(
  userId: string,
  callback: (meetings: Meeting[]) => void,
  _onError: (error: Error) => void,
): () => void {
  const existing = subscribers.get(userId) ?? [];
  subscribers.set(userId, [...existing, callback]);

  // Immediately deliver current data; add user to seed meetings so they see examples
  loadMeetings().then(async (all) => {
    // Add user to demo seed meetings if they're not a participant yet
    const needsUpdate = all.some((m) => m.meetingId.startsWith('MH-DEMO') && !m.participants.includes(userId));
    if (needsUpdate) {
      const updated = all.map((m) =>
        m.meetingId.startsWith('MH-DEMO') && !m.participants.includes(userId)
          ? { ...m, participants: [...m.participants, userId] }
          : m,
      );
      await saveMeetings(updated);
      // saveMeetings notifies via the subscribers map — but we must deliver directly
      // because this subscription was added before saveMeetings was called
      callback(updated.filter((m) => m.participants.includes(userId)));
    } else {
      callback(all.filter((m) => m.participants.includes(userId)));
    }
  }).catch(_onError);

  return () => {
    const subs = subscribers.get(userId) ?? [];
    subscribers.set(userId, subs.filter((s) => s !== callback));
  };
}

export async function demoEndMeeting(meetingId: string): Promise<void> {
  const meetings = await loadMeetings();
  const idx = meetings.findIndex((m) => m.meetingId === meetingId);
  if (idx === -1) throw new Error('Meeting no longer exists.');
  const endedAt = Date.now();
  const m = meetings[idx] as Meeting & { startedAt?: number; endedAt?: number };
  meetings[idx] = {
    ...m,
    status: 'ended',
    endedAt,
    durationSeconds: Math.max(0, Math.floor((endedAt - (m.startedAt ?? endedAt)) / 1000)),
  };
  await saveMeetings([...meetings]);
}
