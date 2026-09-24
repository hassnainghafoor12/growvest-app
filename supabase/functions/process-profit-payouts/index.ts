// Supabase Edge Function: process-profit-payouts
// Calculates and disburses accrued investment returns
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

    // Verify caller is admin or internal cron job
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check admin role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
        return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Query active investments eligible for maturity or periodic return
    const now = new Date().toISOString();
    const { data: investments, error: fetchError } = await supabase
      .from("investments")
      .select(`
        id,
        user_id,
        plan_id,
        invested_amount,
        expected_return_amount,
        accumulated_profit,
        status,
        maturity_date,
        auto_reinvest,
        investment_plans (
          id,
          title,
          return_period,
          expected_return_rate
        )
      `)
      .eq("status", "active")
      .lte("maturity_date", now);

    if (fetchError) {
      throw fetchError;
    }

    let processedCount = 0;
    const results = [];

    for (const inv of investments || []) {
      const plan = inv.investment_plans as any;
      const profit = Number(inv.expected_return_amount) - Number(inv.invested_amount);
      const totalPayout = Number(inv.expected_return_amount);

      // Fetch user wallet
      const { data: wallet } = await supabase
        .from("wallets")
        .select("id, available_balance, invested_balance, total_profit")
        .eq("user_id", inv.user_id)
        .single();

      if (wallet) {
        // Credit principal + profit to available balance, remove from invested
        const newAvailable = Number(wallet.available_balance) + totalPayout;
        const newInvested = Math.max(0, Number(wallet.invested_balance) - Number(inv.invested_amount));
        const newTotalProfit = Number(wallet.total_profit) + profit;

        await supabase
          .from("wallets")
          .update({
            available_balance: newAvailable,
            invested_balance: newInvested,
            total_profit: newTotalProfit,
            updated_at: new Date().toISOString(),
          })
          .eq("id", wallet.id);

        // Mark investment as matured
        await supabase
          .from("investments")
          .update({
            status: "matured",
            accumulated_profit: profit,
            last_payout_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", inv.id);

        // Record payout transaction
        const refId = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        await supabase.from("transactions").insert({
          user_id: inv.user_id,
          wallet_id: wallet.id,
          type: "profit_payout",
          amount: totalPayout,
          fee: 0.00,
          net_amount: totalPayout,
          currency: "USD",
          status: "completed",
          payment_method: "wallet_transfer",
          reference_id: refId,
          metadata: {
            investment_id: inv.id,
            plan_id: inv.plan_id,
            profit,
            principal: inv.invested_amount,
          },
        });

        // Notify user
        await supabase.from("notifications").insert({
          user_id: inv.user_id,
          title: "Investment Matured!",
          body: `Your investment in ${plan?.title || "Plan"} has matured. USD ${totalPayout.toFixed(2)} has been credited to your wallet.`,
          type: "investment_update",
          data: { investment_id: inv.id },
        });

        processedCount++;
        results.push({ investment_id: inv.id, user_id: inv.user_id, totalPayout });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedCount,
        details: results,
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
