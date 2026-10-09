import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebase } from '../firebase/config';
import type { Meeting } from '../types';

type NewMeeting = Pick<
  Meeting,
  'title' | 'description' | 'hostId' | 'hostName' | 'scheduledDate' | 'startTime' | 'endTime'
>;

function makeMeetingId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const part = (size: number) =>
    Array.from({ length: size }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `MH-${part(4)}-${part(3)}`;
}

export async function createMeeting(input: NewMeeting, status: Meeting['status'] = 'scheduled') {
  const { db } = getFirebase();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const meetingId = makeMeetingId();
    const ref = doc(db, 'meetings', meetingId);
    const meeting: Meeting = {
      ...input,
      meetingId,
      participants: [input.hostId],
      createdAt: Date.now(),
      ...(status === 'active' ? { startedAt: Date.now() } : {}),
      status,
    };
    const created = await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists()) return false;
      transaction.set(ref, meeting);
      return true;
    });
    if (created) return meeting;
  }
  throw new Error('Could not reserve a unique meeting code. Please try again.');
}

export async function getMeeting(meetingId: string): Promise<Meeting | null> {
  const { db } = getFirebase();
  const id = meetingId.trim().toUpperCase();
  if (!/^MH-[A-Z0-9]{4}-[A-Z0-9]{3}$/.test(id)) return null;
  const snapshot = await getDoc(doc(db, 'meetings', id));
  return snapshot.exists() ? (snapshot.data() as Meeting) : null;
}

export async function joinMeeting(meetingId: string, userId: string) {
  const { db } = getFirebase();
  const ref = doc(db, 'meetings', meetingId.trim().toUpperCase());
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Meeting not found. Check the meeting code and try again.');
    const meeting = snapshot.data() as Meeting;
    if (meeting.status === 'ended') throw new Error('This meeting has ended.');
    transaction.update(ref, {
      participants: arrayUnion(userId),
      status: 'active',
      ...(meeting.status === 'active' ? {} : { startedAt: Date.now() }),
    });
  });
}

export function subscribeToMyMeetings(
  userId: string,
  callback: (meetings: Meeting[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const { db } = getFirebase();
  const meetingsQuery = query(collection(db, 'meetings'), where('participants', 'array-contains', userId));
  return onSnapshot(
    meetingsQuery,
    (snapshot) => callback(snapshot.docs.map((item) => item.data() as Meeting)),
    onError,
  );
}

export async function endMeeting(meetingId: string) {
  const { db } = getFirebase();
  const ref = doc(db, 'meetings', meetingId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Meeting no longer exists.');
    const endedAt = Date.now();
    transaction.update(ref, {
      status: 'ended',
      endedAt,
      durationSeconds: Math.max(0, Math.floor((endedAt - (snapshot.data().startedAt ?? endedAt)) / 1000)),
    });
  });
}

export async function removeParticipant(meetingId: string, hostId: string, participantId: string) {
  const { db } = getFirebase();
  const ref = doc(db, 'meetings', meetingId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Meeting no longer exists.');
    const meeting = snapshot.data() as Meeting;
    if (meeting.hostId !== hostId) throw new Error('Only the host can remove a participant.');
    if (participantId === hostId) throw new Error('The host cannot remove themselves from the meeting.');
  });
  await deleteDoc(doc(db, 'meetings', meetingId, 'participants', participantId));
}
