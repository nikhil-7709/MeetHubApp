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
  // Firebase subscribeToMessages must be synchronous (returns Unsubscribe),
  // so we resolve the async getFirebase() internally before attaching the listener.
  let unsubscribe: Unsubscribe | undefined;

  getFirebase()
    .then(({ db }) => {
      const messagesQuery = query(
        collection(db, 'meetings', meetingId, 'messages'),
        orderBy('timestamp', 'asc'),
        limit(200),
      );
      unsubscribe = onSnapshot(
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
    })
    .catch((err: Error) => onError(err));

  return () => unsubscribe?.();
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
  const { db } = await getFirebase();
  await addDoc(collection(db, 'meetings', meetingId, 'messages'), {
    meetingId,
    senderId,
    senderName,
    message: text,
    timestamp: serverTimestamp(),
  });
}
