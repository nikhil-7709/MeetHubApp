import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorMessage, LoadingSpinner } from '../../../src/components/Feedback';
import { useAuth } from '../../../src/context/AuthContext';
import { useAppTheme } from '../../../src/context/ThemeContext';
import { sendMessage, subscribeToMessages } from '../../../src/services/chatService';
import type { MeetingMessage } from '../../../src/types';

function messageDate(timestamp: MeetingMessage['timestamp']) {
  const date =
    typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp
      ? (timestamp as { toDate: () => Date }).toDate()
      : new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? 'Sending…'
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Initial letter avatar for other participants */
function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: `${color}22` }]}>
      <Text style={[styles.avatarText, { color }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export default function MeetingChatScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const { user } = useAuth();
  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!meetingId) return;
    return subscribeToMessages(
      meetingId,
      (items) => {
        setMessages(items);
        setLoading(false);
        setError('');
      },
      (reason) => {
        setError(reason.message);
        setLoading(false);
      },
    );
  }, [meetingId]);

  // Auto-scroll to newest message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const send = async () => {
    if (!user || !text.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await sendMessage(
        meetingId,
        user.uid,
        user.displayName || user.email || 'MeetHub member',
        text.trim(),
      );
      setText('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: MeetingMessage; index: number }) => {
    const own = item.senderId === user?.uid;
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const isSameGroup = prevMsg?.senderId === item.senderId;

    return (
      <View
        style={[
          styles.messageRow,
          own ? styles.ownRow : styles.otherRow,
          isSameGroup && styles.groupedRow,
        ]}
      >
        {/* Avatar for other users — show only on first message in a group */}
        {!own && (
          <View style={styles.avatarCol}>
            {!isSameGroup ? (
              <Avatar name={item.senderName} color={colors.primary} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
          </View>
        )}

        {/* Message bubble */}
        <View style={styles.bubbleCol}>
          {/* Sender name label — only on first of a group */}
          {!own && !isSameGroup && (
            <Text style={[styles.senderLabel, { color: colors.primary }]}>{item.senderName}</Text>
          )}

          <View
            style={[
              styles.bubble,
              own
                ? [styles.ownBubble, { backgroundColor: colors.primary }]
                : [
                    styles.otherBubble,
                    {
                      backgroundColor: dark ? '#1E293B' : '#F1F5F9',
                      borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                    },
                  ],
            ]}
          >
            <Text style={[styles.messageText, { color: own ? '#FFFFFF' : colors.text }]}>
              {item.message}
            </Text>
            <Text
              style={[
                styles.timeText,
                { color: own ? 'rgba(255,255,255,0.65)' : colors.muted },
              ]}
            >
              {messageDate(item.timestamp)}
              {own && (
                <Text style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {' '}
                  ✓
                </Text>
              )}
            </Text>
          </View>
        </View>

        {/* Spacer on the left for own messages (keeps them right-aligned) */}
        {own && <View style={styles.avatarPlaceholder} />}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: dark ? '#0A0F1D' : '#F8FAFC' }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            backgroundColor: dark ? '#0F172A' : '#FFFFFF',
            borderBottomColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
          },
        ]}
      >
        <View style={[styles.headerIconWrap, { backgroundColor: `${colors.primary}18` }]}>
          <MaterialCommunityIcons name="chat-processing-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Meeting Chat</Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Error */}
        {error ? <ErrorMessage message={error} /> : null}

        {/* Messages list */}
        {loading ? (
          <LoadingSpinner label="Loading messages…" />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.messageId}
            renderItem={renderMessage}
            contentContainerStyle={
              messages.length ? styles.listContent : styles.emptyContent
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons
                  name="chat-sleep-outline"
                  size={48}
                  color={colors.muted}
                  style={{ marginBottom: 12 }}
                />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No messages yet</Text>
                <Text style={[styles.emptyBody, { color: colors.muted }]}>
                  Say hello to the room 👋
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Composer bar */}
        <View
          style={[
            styles.composer,
            {
              paddingBottom: insets.bottom + 8,
              backgroundColor: dark ? '#0F172A' : '#FFFFFF',
              borderTopColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
            },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write a message…"
            placeholderTextColor={colors.muted}
            maxLength={2000}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => void send()}
            blurOnSubmit
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: dark ? '#1E293B' : '#F1F5F9',
                borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
              },
            ]}
          />
          <Pressable
            accessibilityLabel="Send message"
            disabled={!text.trim() || sending}
            onPress={() => void send()}
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: colors.primary },
              (!text.trim() || sending) && { opacity: 0.45 },
              pressed && { transform: [{ scale: 0.93 }] },
            ]}
          >
            {sending ? (
              <MaterialCommunityIcons name="dots-horizontal" size={20} color="white" />
            ) : (
              <MaterialCommunityIcons name="send" size={19} color="white" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },

  // ── Message list ─────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 4,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
  },

  // ── Message row ─────────────────────────────────────────────────────────────
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
  },
  ownRow: {
    flexDirection: 'row-reverse',   // my messages flow from the RIGHT
  },
  otherRow: {
    flexDirection: 'row',           // their messages flow from the LEFT
  },
  groupedRow: {
    marginVertical: 1,
  },

  // ── Avatar column ────────────────────────────────────────────────────────────
  avatarCol: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginRight: 8,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  avatarPlaceholder: {
    width: 42,  // keeps the bubble from stretching full-width on my-side
  },

  // ── Bubble ───────────────────────────────────────────────────────────────────
  bubbleCol: {
    maxWidth: '72%',
    flexShrink: 1,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  ownBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },

  // ── Composer ─────────────────────────────────────────────────────────────────
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 110,
    lineHeight: 20,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
