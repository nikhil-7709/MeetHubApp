import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { isFirebaseConfigured } from '../firebase/config';

// Safe handler — guarded so it doesn't crash if expo-notifications isn't available
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // expo-notifications not available in this environment
}

export async function scheduleMeetingReminder(
  userId: string,
  meetingId: string,
  title: string,
  startTime: number,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const currentPermission = await Notifications.getPermissionsAsync();
    const granted =
      currentPermission.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) {
      throw new Error('Notifications are disabled. Enable them in settings to receive reminders.');
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('meetings', {
        name: 'Meeting reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const reminderAt = Math.max(Date.now() + 1000, startTime - 15 * 60 * 1000);
    const minutesUntilStart = Math.max(1, Math.ceil((startTime - reminderAt) / 60_000));
    const body = `${title} starts in about ${minutesUntilStart} minute${minutesUntilStart === 1 ? '' : 's'}.`;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'MeetHub meeting reminder',
        body,
        sound: 'default',
        data: { meetingId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminderAt),
        channelId: 'meetings',
      },
    });

    // Only save to Firestore when Firebase is configured
    if (isFirebaseConfigured()) {
      const { doc, setDoc } = await import('firebase/firestore');
      const { getFirebase } = await import('../firebase/config');
      const { db } = await getFirebase();
      await setDoc(doc(db, 'notifications', notificationId), {
        notificationId,
        userId,
        meetingId,
        title: 'Meeting reminder',
        message: body,
        timestamp: Date.now(),
        scheduledFor: reminderAt,
        sent: false,
        read: false,
      });
    }

    return notificationId;
  } catch (error) {
    throw error;
  }
}

export async function registerDeviceForPush(userId: string) {
  if (!isFirebaseConfigured()) {
    throw new Error('Push notifications require Firebase to be configured.');
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  const granted =
    currentPermission.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) {
    throw new Error('Push notifications are disabled. Enable them in settings to continue.');
  }

  const deviceToken = await Notifications.getDevicePushTokenAsync();
  const { doc, setDoc } = await import('firebase/firestore');
  const { getFirebase } = await import('../firebase/config');
  const { db } = await getFirebase();
  const tokenId = encodeURIComponent(String(deviceToken.data));
  await setDoc(doc(db, 'users', userId, 'devices', tokenId), {
    token: String(deviceToken.data),
    platform: deviceToken.type,
    updatedAt: Date.now(),
  });
}
