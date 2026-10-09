import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebase } from '../firebase/config';
import type { MeetingMessage } from '../types';

export function subscribeToMessages(
  meetingId: string,
  callback: (messages: MeetingMessage[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const { db } = getFirebase();
  const messagesQuery = query(
    collection(db, 'meetings', meetingId, 'messages'),
    orderBy('timestamp', 'asc'),
    limit(200),
  );
  return onSnapshot(
    messagesQuery,
    (snapshot) =>
      callback(
        snapshot.docs.map((item) => ({
          ...(item.data() as Omit<MeetingMessage, 'messageId' | 'meetingId'>),
          messageId: item.id,
          meetingId,
        })),
      ),
    onError,
  );
}

export async function sendMessage(
  meetingId: string,
  senderId: string,
  senderName: string,
  message: string,
) {
  const text = message.trim();
  if (!text || text.length > 2000) {
    throw new Error('Messages must be between 1 and 2,000 characters.');
  }
  const { db } = getFirebase();
  await addDoc(collection(db, 'meetings', meetingId, 'messages'), {
    meetingId,
    senderId,
    senderName,
    message: text,
    timestamp: serverTimestamp(),
  });
}
