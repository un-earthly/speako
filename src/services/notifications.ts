import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(uid: string): Promise<void> {
  if (!Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  // Native FCM (Android) / APNs (iOS) token — no Expo cloud involved
  const { data: token } = await Notifications.getDevicePushTokenAsync();
  await updateDoc(doc(db, 'users', uid), {
    pushToken: token,
    pushPlatform: Platform.OS, // 'android' | 'ios' — needed to call the right API when sending
  });
}

// FCM_NOTIFY_URL points to your notification sender endpoint.
// This must be a server-side function (Cloudflare Worker, Supabase Edge Function, etc.)
// that holds the FCM service account key and calls FCM V1 API.
// See functions/notify/README.md for the minimal implementation.
const FCM_NOTIFY_URL = process.env.EXPO_PUBLIC_NOTIFY_URL ?? '';

export async function sendPushNotification(
  recipientUid: string,
  senderName: string,
  messageText: string,
  conversationId: string,
): Promise<void> {
  if (!FCM_NOTIFY_URL) return;

  try {
    const userSnap = await getDoc(doc(db, 'users', recipientUid));
    if (!userSnap.exists()) return;

    const { pushToken, pushPlatform } = userSnap.data() ?? {};
    if (!pushToken) return;

    await fetch(FCM_NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: pushToken,
        platform: pushPlatform ?? 'android',
        title: senderName,
        body: messageText,
        data: { conversationId },
      }),
    });
  } catch {
    // Notification failure is non-critical — message was already saved
  }
}
