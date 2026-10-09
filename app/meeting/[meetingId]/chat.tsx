import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ErrorMessage, LoadingSpinner } from '../../../src/components/Feedback';
import { Screen } from '../../../src/components/Screen';
import { useAuth } from '../../../src/context/AuthContext';
import { useAppTheme } from '../../../src/context/ThemeContext';
import { sendMessage, subscribeToMessages } from '../../../src/services/chatService';
import type { MeetingMessage } from '../../../src/types';
import { Timestamp } from 'firebase/firestore';

function messageDate(timestamp: MeetingMessage['timestamp']) {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Sending…' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function MeetingChatScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!meetingId) return;
    return subscribeToMessages(meetingId, (items) => {
      setMessages(items);
      setLoading(false);
      setError('');
    }, (reason) => {
      setError(reason.message);
      setLoading(false);
    });
  }, [meetingId]);

  const send = async () => {
    if (!user || !text.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await sendMessage(meetingId, user.uid, user.displayName || user.email || 'MeetHub member', text);
      setText('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <Text style={[styles.heading, { color: colors.text }]}>Meeting chat</Text>
        {error ? <ErrorMessage message={error} /> : null}
        {loading ? <LoadingSpinner label="Loading messages…" /> : <FlatList
          data={messages}
          keyExtractor={(item) => item.messageId}
          contentContainerStyle={messages.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.muted }]}>No messages yet. Say hello to the room.</Text>}
          renderItem={({ item }) => {
            const own = item.senderId === user?.uid;
            return <View style={[styles.messageRow, own && styles.ownRow]}><View style={[styles.bubble, { backgroundColor: own ? colors.primary : colors.surface, borderColor: colors.border }]}><Text style={[styles.sender, { color: own ? '#FFFFFFC9' : colors.primary }]}>{own ? 'You' : item.senderName}</Text><Text style={[styles.message, { color: own ? 'white' : colors.text }]}>{item.message}</Text><Text style={[styles.time, { color: own ? '#FFFFFFA8' : colors.muted }]}>{messageDate(item.timestamp)}</Text></View></View>;
          }}
        />}
        <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}><TextInput value={text} onChangeText={setText} placeholder="Write a message…" placeholderTextColor={colors.muted} maxLength={2000} returnKeyType="send" onSubmitEditing={() => void send()} style={[styles.input, { color: colors.text }]} /><Pressable accessibilityLabel="Send message" disabled={!text.trim() || sending} onPress={() => void send()} style={[styles.send, { backgroundColor: colors.primary, opacity: text.trim() && !sending ? 1 : 0.5 }]}><MaterialCommunityIcons name="send" size={19} color="white" /></Pressable></View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 10 },
  flex: { flex: 1 },
  heading: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  list: { paddingVertical: 10, gap: 11 },
  emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', fontSize: 14 },
  messageRow: { alignItems: 'flex-start' },
  ownRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '85%', borderWidth: 1, borderRadius: 16, padding: 11, minWidth: 100 },
  sender: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  message: { fontSize: 14, lineHeight: 19 },
  time: { fontSize: 10, marginTop: 5, alignSelf: 'flex-end' },
  composer: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minHeight: 42, maxHeight: 100, paddingHorizontal: 8 },
  send: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
});
