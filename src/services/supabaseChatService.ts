import { getSupabase } from '../supabase/config';
import type { MeetingMessage } from '../types';

export async function sendMeetingMessage(
  meetingId: string,
  senderId: string,
  senderName: string,
  message: string,
): Promise<string> {
  const supabase = getSupabase();
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = Date.now();

  const { error } = await supabase.from('meeting_messages').insert({
    message_id: messageId,
    meeting_id: meetingId,
    sender_id: senderId,
    sender_name: senderName,
    message: message.trim(),
    timestamp: now,
  });

  if (error) throw error;
  return messageId;
}

export function subscribeToMeetingMessages(
  meetingId: string,
  callback: (messages: MeetingMessage[]) => void,
): () => void {
  const supabase = getSupabase();
  let isSubscribed = true;

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('meeting_messages')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('timestamp', { ascending: true });

    if (data && isSubscribed) {
      const formatted: MeetingMessage[] = data.map((row) => ({
        messageId: row.message_id,
        meetingId: row.meeting_id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        message: row.message,
        timestamp: Number(row.timestamp),
      }));
      callback(formatted);
    }
  };

  void fetchMessages();

  // Listen to incoming messages live via Supabase Realtime with unique channel per subscriber
  const channelName = `meeting_messages:${meetingId}:${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'meeting_messages',
        filter: `meeting_id=eq.${meetingId}`,
      },
      () => {
        // Refetch to maintain ordering and completeness
        void fetchMessages();
      },
    )
    .subscribe();

  return () => {
    isSubscribed = false;
    void supabase.removeChannel(channel);
  };
}
