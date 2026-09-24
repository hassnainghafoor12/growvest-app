/**
 * GROWVEST ANDROID PUSH NOTIFICATION SERVICE
 * Manages:
 * - Android Notification Channels (High Priority, Vibration, Sound)
 * - Push Permission Requests
 * - Expo Push Token Registration with Supabase DB (push_device_tokens)
 * - Deep Linking on Notification Tap
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Configure foreground presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register Android device for push notifications and sync token to Supabase
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return null;
  }

  // Set up Android high-priority notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('growvest_default', {
      name: 'Growvest Transactions & Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }

  // Verify physical device
  if (!Device.isDevice) {
    console.log('[Push] Must use physical device for push notifications');
    return null;
  }

  // Check & request permissions
  const permSettings = await Notifications.getPermissionsAsync();
  let finalStatus = (permSettings as any).status || ((permSettings as any).granted ? 'granted' : 'undetermined');

  if (finalStatus !== 'granted') {
    const reqSettings = await Notifications.requestPermissionsAsync();
    finalStatus = (reqSettings as any).status || ((reqSettings as any).granted ? 'granted' : 'denied');
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission not granted for push notifications');
    return null;
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      process.env.EXPO_PUBLIC_PROJECT_ID;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;

    // Upsert token in Supabase push_device_tokens table
    const { error } = await supabase
      .from('push_device_tokens')
      .upsert(
        {
          user_id: userId,
          expo_push_token: token,
          device_brand: Device.brand || 'Android',
          device_model: Device.modelName || 'Device',
          os_version: Device.osVersion || 'Android',
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'expo_push_token' }
      );

    if (error) {
      console.warn('[Push] Failed to store push token in Supabase:', error.message);
    } else {
      console.log('[Push] Push token synced with Supabase for user:', userId);
    }

    return token;
  } catch (error) {
    console.error('[Push] Error getting push token:', error);
    return null;
  }
}

/**
 * Setup notification response listeners for deep linking
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
) {
  // Listener for notifications received while app is foregrounded
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Listener for when a user taps a notification in the Android system tray
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    if (onNotificationTapped) {
      onNotificationTapped(response);
    }
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
