// Supabase Edge Function: approve-transaction
// Secure server-side processing of deposit/withdrawal approvals
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

    // Verify caller authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is an active administrator
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin") || profile.status !== "active") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin privileges required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transaction_id, action, admin_notes } = await req.json();

    if (!transaction_id || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid request payload. 'transaction_id' and 'action' (approve|reject) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    // Call PostgreSQL stored procedure with row locking
    const { data, error: rpcError } = await supabase.rpc("process_transaction_review", {
      p_transaction_id: transaction_id,
      p_new_status: newStatus,
      p_admin_notes: admin_notes || null,
    });

    // Fetch transaction details for push notification
    const { data: tx } = await supabase
      .from("transactions")
      .select("user_id, type, amount, currency")
      .eq("id", transaction_id)
      .single();

    if (tx) {
      const title = action === "approve" ? "Transaction Approved!" : "Transaction Declined";
      const body = action === "approve"
        ? `Your ${tx.type} of ${tx.currency} ${Number(tx.amount).toFixed(2)} has been approved.`
        : `Your ${tx.type} request was declined. ${admin_notes || ""}`.trim();

      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            user_id: tx.user_id,
            title,
            body,
            notification_type: "transaction_status",
            data: { screen: "wallet", transaction_id, status: newStatus },
          },
        });
      } catch (pushErr) {
        console.warn("Push dispatch warning in approve-transaction:", pushErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, transaction_id, status: newStatus, details: data }),
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
