import { supabase } from './supabase';

export interface DispatchPushNotificationParams {
  userId?: string | null; // null for broadcast to all users
  title: string;
  body: string;
  notificationType?: string;
  data?: Record<string, any>;
}

/**
 * Dispatches an Android push notification via Supabase Edge Function
 * and persists the alert in the notifications table.
 *
 * Architecture:
 * Admin -> Supabase -> Edge Function ('send-push-notification') -> Expo Push Service -> Android Device Tray
 */
export async function dispatchAdminPushNotification({
  userId,
  title,
  body,
  notificationType = 'system_announcement',
  data = {},
}: DispatchPushNotificationParams): Promise<{ success: boolean; deliveredTokens?: number; error?: string }> {
  try {
    // 1. Invoke Supabase Edge Function to reach Android devices
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke(
      'send-push-notification',
      {
        body: {
          user_id: userId || null,
          title: title.trim(),
          body: body.trim(),
          notification_type: notificationType,
          data,
        },
      }
    );

    if (edgeErr) {
      console.warn('[PushDispatcher] Edge function warning, applying direct DB fallback:', edgeErr.message);

      // Fallback: Store directly in notifications table so Supabase Realtime still emits to open apps
      const { error: dbErr } = await supabase.from('notifications').insert({
        user_id: userId || null,
        title: title.trim(),
        body: body.trim(),
        type: notificationType,
        data,
      });

      if (dbErr) {
        console.error('[PushDispatcher] DB fallback error:', dbErr.message);
        return { success: false, error: dbErr.message };
      }

      return { success: true, deliveredTokens: 0 };
    }

    return {
      success: true,
      deliveredTokens: edgeData?.delivered_tokens_count ?? 0,
    };
  } catch (err: any) {
    console.error('[PushDispatcher] Unexpected error sending push notification:', err);
    return { success: false, error: err.message };
  }
}
