// G Swing — Golf API proxy (GolfAPI.io).
// Single backend gateway between the frontend and GolfAPI.io. Uses the
// GOLF_API_KEY server secret and never returns it to the client.
//
// Actions (POST body: { action, ...params }):
//   • search   – GET /clubs (params: name, city, state, country, lat, lng, measureUnit, page)
//   • club     – GET /clubs/{id}
//   • courses  – GET /courses (search params like /clubs)
//   • course   – GET /courses/{id}   (full course with holes+tees; caches into DB)
//   • coordinates – GET /coordinates/{id}  (GPS PoIs; caches into DB)
//   • health   – ping /clubs?name=test to verify the key
//   • logs     – return last 100 golf_api_logs rows (admin only)
//   • stats    – cache counts (clubs/courses/coordinates)

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://golfapi.io/api/v2.3";
const API_KEY = Deno.env.get("GOLF_API_KEY") ?? "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Detect vendor quota / rate-limit style errors so we can surface a graceful
// fallback signal to the client instead of a raw 401/429 that the UI treats
// as an auth failure (blank screen).
function isQuotaError(status: number, error: string | undefined): boolean {
  if (status === 429) return true;
  const msg = (error ?? "").toLowerCase();
  return (
    msg.includes("api request limit") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("too many requests")
  );
}

function vendorFail(r: { status: number; error: string }) {
  if (isQuotaError(r.status, r.error)) {
    return json(
      {
        error: "API_RATE_LIMIT_EXCEEDED",
        message: r.error,
        fallback: true,
        reason: "quota_exceeded",
        vendorStatus: r.status,
      },
      200,
    );
  }
  // Never leak a raw 401 from the vendor — remap to 502 so the frontend
  // doesn't mistake it for a Supabase auth problem.
  const safeStatus = r.status === 401 || r.status === 403 ? 502 : r.status || 502;
  return json({ error: r.error, vendorStatus: r.status }, safeStatus);
}

async function currentUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data } = await supa.auth.getClaims(auth.replace("Bearer ", ""));
  return (data?.claims?.sub as string | undefined) ?? null;
}

async function logCall(row: {
  endpoint: string;
  params: unknown;
  status: number;
  latency_ms: number;
  api_requests_left: string | null;
  error: string | null;
  user_id: string | null;
}) {
  try {
    await admin.from("golf_api_logs").insert(row);
  } catch (_e) { /* logs must never break the response */ }
}

async function callVendor(path: string, query: Record<string, string | number | undefined>, userId: string | null) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  const t0 = Date.now();
  let status = 0;
  let text = "";
  let apiLeft: string | null = null;
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    status = res.status;
    text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = null; }
    apiLeft = (data as { apiRequestsLeft?: string })?.apiRequestsLeft ?? null;
    await logCall({
      endpoint: url.pathname,
      params: query,
      status,
      latency_ms: Date.now() - t0,
      api_requests_left: apiLeft,
      error: res.ok ? null : text.slice(0, 500),
      user_id: userId,
    });
    if (!res.ok) {
      return { ok: false as const, status, error: text || `HTTP ${status}` };
    }
    return { ok: true as const, status, data: data ?? {}, apiRequestsLeft: apiLeft };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCall({
      endpoint: url.pathname,
      params: query,
      status: 0,
      latency_ms: Date.now() - t0,
      api_requests_left: null,
      error: msg,
      user_id: userId,
    });
    return { ok: false as const, status: 0, error: msg };
  }
}

function toNum(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim() !== "") {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function toInt(x: unknown): number | null {
  const n = toNum(x);
  return n === null ? null : Math.round(n);
}
function toBool(x: unknown): boolean {
  if (typeof x === "boolean") return x;
  if (typeof x === "number") return x !== 0;
  if (typeof x === "string") return x === "1" || x.toLowerCase() === "true";
  return false;
}

// -- Cache upserts ---------------------------------------------------------

async function cacheClub(raw: Record<string, unknown>) {
  if (!raw?.clubID) return;
  await admin.from("golfapi_clubs").upsert({
    club_id: String(raw.clubID),
    club_name: String(raw.clubName ?? ""),
    address: (raw.address as string) ?? null,
    postal_code: (raw.postalCode as string) ?? null,
    city: (raw.city as string) ?? null,
    state: (raw.state as string) ?? null,
    country: (raw.country as string) ?? null,
    country2: (raw.country2 as string) ?? null,
    latitude: toNum(raw.latitude),
    longitude: toNum(raw.longitude),
    website: (raw.website as string) ?? null,
    telephone: (raw.telephone as string) ?? null,
    timestamp_updated: toInt(raw.timestampUpdated),
    raw: raw,
    updated_at: new Date().toISOString(),
  }, { onConflict: "club_id" });
}

async function cacheCourse(raw: Record<string, unknown>) {
  if (!raw?.courseID) return;
  const courseId = String(raw.courseID);
  const clubId = raw.clubID ? String(raw.clubID) : null;
  await admin.from("golfapi_courses").upsert({
    course_id: courseId,
    club_id: clubId,
    course_name: String(raw.courseName ?? ""),
    num_holes: toInt(raw.numHoles) ?? 18,
    has_gps: toBool(raw.hasGPS),
    measure: (raw.measure as string) ?? null,
    pars_men: Array.isArray(raw.parsMen) ? raw.parsMen : null,
    indexes_men: Array.isArray(raw.indexesMen) ? raw.indexesMen : null,
    pars_women: Array.isArray(raw.parsWomen) ? raw.parsWomen : null,
    indexes_women: Array.isArray(raw.indexesWomen) ? raw.indexesWomen : null,
    latitude: toNum(raw.latitude),
    longitude: toNum(raw.longitude),
    timestamp_updated: toInt(raw.timestampUpdated),
    raw: raw,
    updated_at: new Date().toISOString(),
  }, { onConflict: "course_id" });

  const tees = Array.isArray(raw.tees) ? (raw.tees as Array<Record<string, unknown>>) : [];
  if (tees.length) {
    const rows = tees.map((t) => {
      const lengths: number[] = [];
      for (let i = 1; i <= 18; i++) {
        const v = toInt(t[`length${i}`]);
        if (v !== null) lengths.push(v);
      }
      return {
        tee_id: String(t.teeID),
        course_id: courseId,
        tee_name: (t.teeName as string) ?? null,
        tee_color: (t.teeColor as string) ?? null,
        lengths: lengths.length ? lengths : null,
        course_rating_men: toNum(t.courseRatingMen),
        slope_men: toInt(t.slopeMen),
        course_rating_women: toNum(t.courseRatingWomen),
        slope_women: toInt(t.slopeWomen),
        raw: t,
        updated_at: new Date().toISOString(),
      };
    }).filter((r) => r.tee_id && r.tee_id !== "undefined");
    if (rows.length) await admin.from("golfapi_tees").upsert(rows, { onConflict: "tee_id" });
  }
}

async function cacheCoordinates(courseId: string, raw: Record<string, unknown>) {
  const list = Array.isArray(raw.coordinates) ? (raw.coordinates as Array<Record<string, unknown>>) : [];
  if (!list.length) return;
  // Replace: coordinates are a full snapshot for the course.
  await admin.from("golfapi_coordinates").delete().eq("course_id", courseId);
  const rows = list.map((c) => ({
    course_id: courseId,
    hole: toInt(c.hole) ?? 0,
    poi: toInt(c.poi) ?? 0,
    location: toInt(c.location),
    side_fw: toInt(c.sideFW),
    latitude: toNum(c.latitude) ?? 0,
    longitude: toNum(c.longitude) ?? 0,
  }));
  // Chunk large inserts (Postgres will accept but keep payloads reasonable).
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    await admin.from("golfapi_coordinates").insert(rows.slice(i, i + chunk));
  }
}

// -- Handler ---------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!API_KEY) return json({ error: "GOLF_API_KEY is not configured on the server." }, 500);

  const userId = await currentUserId(req);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const action = String(body.action ?? "").toLowerCase();

  if (action === "health") {
    const r = await callVendor("/clubs", { name: "pebble", country: "usa" }, userId);
    if (!r.ok) return json({ ok: false, error: r.error, status: r.status }, 200);
    return json({ ok: true, apiRequestsLeft: r.apiRequestsLeft, status: r.status });
  }

  if (action === "search") {
    const { name, city, state, country, lat, lng, measureUnit, page } = body as Record<string, string | number | undefined>;
    const r = await callVendor("/clubs", { name, city, state, country, lat, lng, measureUnit, page }, userId);
    if (!r.ok) return vendorFail(r);
    // Opportunistically cache each club (light payload).
    const clubs = Array.isArray((r.data as { clubs?: unknown[] }).clubs) ? (r.data as { clubs: Record<string, unknown>[] }).clubs : [];
    for (const c of clubs) await cacheClub(c);
    return json(r.data);
  }

  if (action === "courses") {
    const { name, city, state, country, lat, lng, measureUnit, page } = body as Record<string, string | number | undefined>;
    const r = await callVendor("/courses", { name, city, state, country, lat, lng, measureUnit, page }, userId);
    if (!r.ok) return vendorFail(r);
    return json(r.data);
  }

  if (action === "club") {
    const id = String(body.id ?? "");
    if (!id) return json({ error: "id is required" }, 400);
    const r = await callVendor(`/clubs/${encodeURIComponent(id)}`, {}, userId);
    if (!r.ok) return vendorFail(r);
    await cacheClub(r.data as Record<string, unknown>);
    return json(r.data);
  }

  if (action === "course") {
    const id = String(body.id ?? "");
    if (!id) return json({ error: "id is required" }, 400);
    const r = await callVendor(`/courses/${encodeURIComponent(id)}`, {}, userId);
    if (!r.ok) return vendorFail(r);
    const raw = r.data as Record<string, unknown>;
    await cacheCourse(raw);
    return json(raw);
  }

  if (action === "coordinates") {
    const id = String(body.id ?? "");
    if (!id) return json({ error: "id is required" }, 400);
    const r = await callVendor(`/coordinates/${encodeURIComponent(id)}`, {}, userId);
    if (!r.ok) return vendorFail(r);
    const raw = r.data as Record<string, unknown>;
    await cacheCoordinates(id, raw);
    return json(raw);
  }

  if (action === "logs") {
    const { data } = await admin
      .from("golf_api_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return json({ logs: data ?? [] });
  }

  if (action === "stats") {
    const [{ count: clubCount }, { count: courseCount }, { count: coordCount }] = await Promise.all([
      admin.from("golfapi_clubs").select("*", { count: "exact", head: true }),
      admin.from("golfapi_courses").select("*", { count: "exact", head: true }),
      admin.from("golfapi_coordinates").select("*", { count: "exact", head: true }),
    ]);
    return json({ clubs: clubCount ?? 0, courses: courseCount ?? 0, coordinates: coordCount ?? 0 });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});