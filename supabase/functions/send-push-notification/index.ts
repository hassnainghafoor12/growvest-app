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

    const { user_id, title, body, data, notification_type } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Store notification in database
    const { data: dbNotification, error: dbError } = await supabase
      .from("notifications")
      .insert({
        user_id: user_id || null,
        title,
        body,
        type: notification_type || "system_announcement",
        data: data || {},
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    // 2. Fetch target Expo Push Tokens
    let tokenQuery = supabase
      .from("push_device_tokens")
      .select("expo_push_token")
      .eq("is_active", true);

    if (user_id) {
      tokenQuery = tokenQuery.eq("user_id", user_id);
    }

    const { data: tokens, error: tokenError } = await tokenQuery;
    if (tokenError) {
      throw tokenError;
    }

    const validTokens = (tokens || [])
      .map((t) => t.expo_push_token)
      .filter((t) => t && t.startsWith("ExponentPushToken"));

    // 3. Dispatch to Expo Push Service
    let pushResponseData = null;
    if (validTokens.length > 0) {
      const messages = validTokens.map((token) => ({
        to: token,
        sound: "default",
        title,
        body,
        data: { ...data, notification_id: dbNotification.id },
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
