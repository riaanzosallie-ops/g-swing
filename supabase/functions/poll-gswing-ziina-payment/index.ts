import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZIINA_BASE = "https://api-v2.ziina.com/api";

function res(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normaliseStatus(s: string | undefined): string {
  const v = (s ?? "").toLowerCase();
  if (["completed", "paid", "succeeded", "success"].includes(v)) return "paid";
  if (["failed", "failure", "error"].includes(v)) return "failed";
  if (["cancelled", "canceled"].includes(v)) return "cancelled";
  if (["expired"].includes(v)) return "expired";
  return "pending";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return res({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return res({ error: "Missing authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ziinaKey = Deno.env.get("ZIINA_API_KEY");
  if (!ziinaKey) return res({ error: "Payment unavailable. Please try again." }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return res({ error: "Unauthenticated" }, 401);
  const user = userData.user;

  let session_id: string;
  try {
    const body = (await req.json()) as { session_id?: string };
    if (!body?.session_id) return res({ error: "session_id required" }, 400);
    session_id = body.session_id;
  } catch {
    return res({ error: "Invalid JSON" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: session, error: sErr } = await admin
    .from("gswing_payment_sessions")
    .select("*")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (sErr || !session) return res({ error: "Session not found" }, 404);

  // Already terminal — short-circuit.
  if (["paid", "failed", "cancelled", "expired"].includes(session.status)) {
    return res({ status: session.status, session });
  }

  const ziinaRes = await fetch(`${ZIINA_BASE}/payment_intent/${session.provider_session_id}`, {
    headers: { Authorization: `Bearer ${ziinaKey}` },
  });
  const ziinaJson = await ziinaRes.json().catch(() => ({}));
  if (!ziinaRes.ok) {
    return res({ status: session.status, error: "Provider unavailable", detail: ziinaJson }, 502);
  }
  const status = normaliseStatus(ziinaJson?.status);

  await admin
    .from("gswing_payment_sessions")
    .update({
      status,
      status_message: ziinaJson?.status ?? null,
      raw_response: ziinaJson,
      paid_at: status === "paid" ? new Date().toISOString() : session.paid_at,
    })
    .eq("id", session.id);

  if (status === "paid") {
    const cycle = session.billing_cycle === "yearly" ? 365 : 30;
    const periodEnd = new Date(Date.now() + cycle * 24 * 60 * 60 * 1000).toISOString();
    const { error: upErr } = await admin.from("gswing_user_memberships").upsert(
      {
        user_id: user.id,
        plan_code: session.plan_code,
        billing_cycle: session.billing_cycle,
        status: "active",
        activated_at: new Date().toISOString(),
        current_period_end: periodEnd,
        last_payment_session_id: session.id,
      },
      { onConflict: "user_id" },
    );
    if (upErr) return res({ status, error: "Membership write failed", detail: upErr.message }, 500);

    await admin.from("gswing_membership_audit").insert({
      user_id: user.id,
      event_type: "payment_activated",
      plan_code: session.plan_code,
      payment_session_id: session.id,
      details: { billing_cycle: session.billing_cycle, amount_aed: session.amount_aed },
    });
  }

  return res({ status, session_id: session.id });
});