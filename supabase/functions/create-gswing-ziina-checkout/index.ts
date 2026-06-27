import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZIINA_BASE = "https://api-v2.ziina.com/api";

type Body = { plan_code: "premium" | "elite"; billing_cycle: "monthly" | "yearly"; return_url: string };

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return bad("Missing authorization", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ziinaKey = Deno.env.get("ZIINA_API_KEY");
  if (!ziinaKey) return bad("Payment unavailable. Please try again.", 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return bad("Unauthenticated", 401);
  const user = userData.user;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("Invalid JSON");
  }
  if (!["premium", "elite"].includes(body.plan_code)) return bad("Invalid plan_code");
  if (!["monthly", "yearly"].includes(body.billing_cycle)) return bad("Invalid billing_cycle");
  if (!body.return_url || !/^https?:\/\//.test(body.return_url)) return bad("Invalid return_url");

  // Read pricing from DB (source of truth).
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: plan, error: planErr } = await admin
    .from("gswing_membership_plans")
    .select("plan_code, display_name, price_monthly_aed, price_yearly_aed, is_paid, active")
    .eq("plan_code", body.plan_code)
    .maybeSingle();
  if (planErr || !plan || !plan.active || !plan.is_paid) return bad("Plan unavailable");
  const amountAed = Number(
    body.billing_cycle === "monthly" ? plan.price_monthly_aed : plan.price_yearly_aed,
  );
  if (!amountAed || amountAed <= 0) return bad("Plan not priced");

  // Ziina amounts are in fils (1 AED = 100 fils).
  const amountFils = Math.round(amountAed * 100);

  const ziinaRes = await fetch(`${ZIINA_BASE}/payment_intent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ziinaKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountFils,
      currency_code: "AED",
      message: `G-Swing ${plan.display_name} (${body.billing_cycle})`,
      success_url: body.return_url,
      cancel_url: body.return_url,
      test: false,
    }),
  });
  const ziinaJson = await ziinaRes.json().catch(() => ({}));
  if (!ziinaRes.ok || !ziinaJson?.id || !ziinaJson?.redirect_url) {
    return new Response(
      JSON.stringify({ error: "Payment unavailable. Please try again.", detail: ziinaJson }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: session, error: sessErr } = await admin
    .from("gswing_payment_sessions")
    .insert({
      user_id: user.id,
      plan_code: body.plan_code,
      billing_cycle: body.billing_cycle,
      amount_aed: amountAed,
      provider: "ziina",
      provider_session_id: ziinaJson.id,
      checkout_url: ziinaJson.redirect_url,
      status: "pending",
      raw_response: ziinaJson,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    .select("id, checkout_url, provider_session_id")
    .single();
  if (sessErr || !session) return bad("Could not record session", 500);

  return new Response(
    JSON.stringify({
      session_id: session.id,
      provider_session_id: session.provider_session_id,
      checkout_url: session.checkout_url,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});