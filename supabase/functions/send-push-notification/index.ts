// Supabase Edge Function: send-push-notification
// Sends push alerts to Android devices via Expo Push API
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const payload = await req.json();

    // Support both direct invocation and Supabase Database Webhook payload
    let userId: string | null = null;
    let title = "";
    let body = "";
    let notificationType = "system_announcement";
    let data: Record<string, any> = {};
    let notificationId: string | null = null;
    let needsDbInsert = true;

    if (payload.record && payload.table === "notifications") {
      // Triggered by Supabase Database Webhook on notifications table INSERT
      const record = payload.record;
      notificationId = record.id;
      userId = record.user_id;
      title = record.title;
      body = record.body;
      notificationType = record.type;
      data = record.data || {};
      needsDbInsert = false; // Already in DB
    } else {
      userId = payload.user_id || null;
      title = payload.title;
      body = payload.body;
      notificationType = payload.notification_type || "system_announcement";
      data = payload.data || {};
      needsDbInsert = !payload.skip_db_insert;
    }

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Store notification in database if not already inserted via DB Webhook
    let dbNotification: any = null;
    if (needsDbInsert) {
      const { data: inserted, error: dbError } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          title,
          body,
          type: notificationType,
          data,
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }
      dbNotification = inserted;
      notificationId = inserted.id;
    }

    // 2. Fetch target Expo Push Tokens
    let tokenQuery = supabase
      .from("push_device_tokens")
      .select("expo_push_token")
      .eq("is_active", true);

    if (userId) {
      tokenQuery = tokenQuery.eq("user_id", userId);
    }

    const { data: tokens, error: tokenError } = await tokenQuery;
    if (tokenError) {
      throw tokenError;
    }

    const validTokens = (tokens || [])
      .map((t: any) => t.expo_push_token)
      .filter((t: string) => t && t.startsWith("ExponentPushToken"));

    // 3. Dispatch to Expo Push Service targeting Android high priority channel
    let pushResponseData = null;
    if (validTokens.length > 0) {
      const messages = validTokens.map((token: string) => ({
        to: token,
        sound: "default",
        channelId: "growvest_default",
        priority: "high",
        title,
        body,
        data: { ...data, notification_id: notificationId, screen: data.screen || "wallet" },
      }));

      const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      pushResponseData = await expoRes.json();
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notificationId,
        notification: dbNotification,
        delivered_tokens_count: validTokens.length,
        expo_response: pushResponseData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
