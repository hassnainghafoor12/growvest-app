import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { registerForPushNotificationsAsync, setupNotificationListeners } from '../../src/lib/pushNotifications';

export default function AppLayout() {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/(auth)/login');
    }
  }, [session, isLoading]);

  // Register Android Device for Push Notifications on Authenticated Session
  useEffect(() => {
    if (session?.user?.id) {
      registerForPushNotificationsAsync(session.user.id);

      const cleanupListeners = setupNotificationListeners(
        (notification) => {
          console.log('[Push] Notification received in foreground:', notification.request.content.title);
        },
        (response) => {
          // Deep link navigation when user taps notification in Android system tray
          const data = response.notification.request.content.data;
          console.log('[Push] User tapped notification:', data);

          if (data?.screen === 'wallet') {
            router.push('/(app)/(tabs)/wallet');
          } else if (data?.screen === 'investments' || data?.screen === 'explore') {
            router.push('/(app)/(tabs)/investments');
          } else if (data?.screen === 'profile') {
            router.push('/(app)/(tabs)/profile');
          } else if (data?.transaction_id) {
            router.push('/(app)/(tabs)/wallet');
          } else if (data?.plan_id || data?.investment_id) {
            router.push('/(app)/(tabs)/investments');
          } else if (data?.kyc_id || data?.account_status || data?.role) {
            router.push('/(app)/(tabs)/profile');
          } else {
            router.push('/(app)/(tabs)');
          }
        }
      );

      return () => {
        cleanupListeners();
      };
    }
  }, [session?.user?.id]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Restoring your secure session...</Text>
      </View>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0F1D' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
});
