// GolfIntelligence proxy — cache-first, credit-safe.
// All external API calls happen ONLY here. Frontend never touches the upstream.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Confirmed production endpoints — GolfIntelligence Swagger v1.
// https://api.golfintelligence.com/swagger/v1/swagger.json
const DEFAULT_ENDPOINTS = {
  search: "/courses/searchCourseGroups",         // POST
  courseDetail: "/courses/getCourseGroupDetail", // GET
  scorecard: "/courses/getCourseGroupScorecard", // GET
  gps: "/courses/getCourseGroupGPS",             // GET
  greenSlope: "/greens/getSlopeImage",           // GET
  elevation: "/greens/getElevationImage",        // GET
};
const ENDPOINTS = {
  search: Deno.env.get("GOLFINTEL_PATH_SEARCH") ?? DEFAULT_ENDPOINTS.search,
  courseDetail: Deno.env.get("GOLFINTEL_PATH_COURSE_DETAIL") ?? DEFAULT_ENDPOINTS.courseDetail,
  scorecard: Deno.env.get("GOLFINTEL_PATH_SCORECARD") ?? DEFAULT_ENDPOINTS.scorecard,
  gps: Deno.env.get("GOLFINTEL_PATH_GPS") ?? DEFAULT_ENDPOINTS.gps,
  greenSlope: Deno.env.get("GOLFINTEL_PATH_GREEN_SLOPE") ?? DEFAULT_ENDPOINTS.greenSlope,
  elevation: Deno.env.get("GOLFINTEL_PATH_ELEVATION") ?? DEFAULT_ENDPOINTS.elevation,
};
// Cold-start warning: list which endpoint paths are still on defaults.
{
  const usingDefaults = (Object.keys(DEFAULT_ENDPOINTS) as (keyof typeof DEFAULT_ENDPOINTS)[])
    .filter((k) => ENDPOINTS[k] === DEFAULT_ENDPOINTS[k]);
  if (usingDefaults.length > 0) {
    console.warn(
      "[golfintel-proxy] Using DEFAULT paths for:",
      usingDefaults.map((k) => `${k}=${DEFAULT_ENDPOINTS[k]}`).join(", "),
      "— set GOLFINTEL_PATH_* env vars to override.",
    );
  }
}
// Lightweight in-memory search counter (observability only, no credits).
let SEARCH_CALLS = 0;

const BASE_URL = Deno.env.get("GOLFINTEL_BASE_URL") ?? "";
const TOKEN = Deno.env.get("GOLFINTEL_TOKEN") ?? "";
const CLIENT_ID = Deno.env.get("GOLFINTEL_CLIENT_ID") ?? "";
const AUTH_PATH = Deno.env.get("GOLFINTEL_PATH_AUTH") ?? "/auth/authenticateToken";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// ---- Token cache (in-memory per isolate) ----
type TokenCache = { accessToken: string; refreshToken: string | null; expiresAt: number };
let TOKEN_CACHE: TokenCache | null = null;
let TOKEN_INFLIGHT: Promise<TokenCache> | null = null;

async function fetchToken(): Promise<TokenCache> {
  if (!BASE_URL || !TOKEN || !CLIENT_ID) throw new Error("upstream_not_configured");
  const url = BASE_URL.replace(/\/$/, "") + AUTH_PATH;
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    code: TOKEN,
    client_id: CLIENT_ID,
  });
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form.toString(),
  });
  const dur = Date.now() - t0;
  const text = await res.text();
  if (!res.ok) {
    console.error(`[golfintel-proxy] auth FAILED status=${res.status} durMs=${dur} body=${text.slice(0, 200)}`);
    throw new Error(`auth_failed_${res.status}`);
  }
  const data = JSON.parse(text);
  const accessToken = data.access_token ?? data.accessToken;
  if (!accessToken) throw new Error("auth_no_access_token");
  const refreshToken = data.refresh_token ?? data.refreshToken ?? null;
  const expiresIn = Number(data.expires_in ?? data.expiresIn ?? 3600);
  const expiresAt = Date.now() + Math.max(60, expiresIn - 60) * 1000;
  console.log(`[golfintel-proxy] auth OK durMs=${dur} expiresIn=${expiresIn}s hasRefresh=${Boolean(refreshToken)}`);
  return { accessToken, refreshToken, expiresAt };
}

async function getAccessToken(force = false): Promise<string> {
  if (!force && TOKEN_CACHE && TOKEN_CACHE.expiresAt > Date.now()) return TOKEN_CACHE.accessToken;
  if (!TOKEN_INFLIGHT) TOKEN_INFLIGHT = fetchToken().finally(() => { TOKEN_INFLIGHT = null; });
  TOKEN_CACHE = await TOKEN_INFLIGHT;
  return TOKEN_CACHE.accessToken;
}

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function upstreamOnce(path: string, init: { method?: string; query?: Record<string, string>; body?: unknown }, accessToken: string) {
  const url = new URL(BASE_URL.replace(/\/$/, "") + path);
  if (init.query) for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(url.toString(), {
      method: init.method ?? "GET",
      signal: controller.signal,
      redirect: "manual",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json,image/*",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function upstream(path: string, init: { method?: string; query?: Record<string, string>; body?: unknown } = {}) {
  if (!BASE_URL || !TOKEN || !CLIENT_ID) throw new Error("upstream_not_configured");
  const t0 = Date.now();
  let authRefreshed = false;
  let accessToken = await getAccessToken();
  let res = await upstreamOnce(path, init, accessToken);
  // If the token is stale/rejected, upstream returns 401 OR redirects to /Account/Login.
  const looksUnauth =
    res.status === 401 ||
    (res.status >= 300 && res.status < 400 && /login/i.test(res.headers.get("location") ?? ""));
  if (looksUnauth) {
    console.warn(`[golfintel-proxy] token rejected on ${path} status=${res.status} — refreshing`);
    accessToken = await getAccessToken(true);
    authRefreshed = true;
    res = await upstreamOnce(path, init, accessToken);
  }
  if (res.status >= 300 && res.status < 400 && /login/i.test(res.headers.get("location") ?? "")) {
    // Still unauthenticated after refresh — surface cleanly.
    return new Response(JSON.stringify({ error: "upstream_unauthenticated" }), { status: 401 });
  }
  const dur = Date.now() - t0;
  const reqId = res.headers.get("x-request-id") ?? res.headers.get("x-correlation-id") ?? "-";
  console.log(`[golfintel-proxy] upstream ${init.method ?? "GET"} ${path} status=${res.status} durMs=${dur} reqId=${reqId} refreshed=${authRefreshed}`);
  return res;
}

function mapUpstreamError(status: number) {
  if (status === 401 || status === 403) return { code: "auth", status: 502 };
  if (status === 404) return { code: "not_found", status: 404 };
  if (status === 429) return { code: "rate_limited", status: 429 };
  return { code: "upstream_error", status: 502 };
}

async function logCredit(action: string, gi_course_id: string | null, hole_number: number | null = null, credits = 1) {
  await admin.from("gi_credit_log").insert({ action, gi_course_id, hole_number, credits_estimated: credits });
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

// ---- actions ----

async function actionSearch(query: string, opts: { countryCode?: string; rows?: number; offset?: number } = {}) {
  if (!query || query.trim().length < 2) return { results: [] };
  SEARCH_CALLS += 1;
  // POST /courses/searchCourseGroups — body per PublicCourseGroupSearchRequestDto.
  const res = await upstream(ENDPOINTS.search, {
    method: "POST",
    body: {
      rows: opts.rows ?? 100,
      offset: opts.offset ?? 0,
      keywords: query,
      countryCode: opts.countryCode ?? "",
      regionCode: "",
      gpsCoordinate: null,
    },
  });
  const reqId = res.headers.get("x-request-id") ?? res.headers.get("x-correlation-id");
  console.log(`[golfintel-proxy] search status=${res.status} calls=${SEARCH_CALLS} reqId=${reqId ?? "-"} q="${query}"`);
  if (!res.ok) return { __error: mapUpstreamError(res.status) };
  const data = await res.json().catch(() => ({}));
  const raw = Array.isArray(data)
    ? data
    : data.rows ?? data.results ?? data.courseGroups ?? data.data ?? data.searchResults ?? [];
  const results = (raw as any[]).map((r) => ({
    giCourseId: String(r.publicId ?? r.PublicId ?? r.id ?? r.courseGroupId ?? ""),
    name: r.name ?? r.courseName ?? r.title ?? "",
    city: r.city ?? r.address?.city ?? r.locality ?? null,
    state: r.state ?? r.address?.state ?? r.region ?? null,
    country: r.country ?? r.address?.country ?? null,
    latitude: r.latitude ?? r.gpsCoordinate?.latitude ?? r.lat ?? null,
    longitude: r.longitude ?? r.gpsCoordinate?.longitude ?? r.lng ?? null,
    holes: r.holes ?? r.holeCount ?? null,
  })).filter((r) => r.giCourseId && r.name);
  return { results };
}

function extractCourseFields(payload: any) {
  return {
    name: payload?.name ?? payload?.courseName ?? payload?.course?.name ?? "Unknown course",
    city: payload?.city ?? payload?.location?.city ?? null,
    state: payload?.state ?? payload?.location?.state ?? null,
    country: payload?.country ?? payload?.location?.country ?? null,
    latitude: payload?.latitude ?? payload?.lat ?? payload?.location?.latitude ?? null,
    longitude: payload?.longitude ?? payload?.lng ?? payload?.lon ?? payload?.location?.longitude ?? null,
    scorecard: payload?.scorecard ?? payload?.scorecards ?? payload?.tees ?? null,
    gps: payload?.gps ?? payload?.markers ?? payload?.holes ?? null,
  };
}

async function actionCourseDetail(giCourseId: string) {
  if (!giCourseId) return { __error: { code: "bad_request", status: 400 } };
  const { data: cached } = await admin.from("gi_courses").select("*").eq("gi_course_id", giCourseId).maybeSingle();
  if (cached?.detail) {
    console.log(`[golfintel-proxy] course-detail cache HIT id=${giCourseId}`);
    return { source: "cache", course: cached };
  }
  // Swagger param: PublicId (query, string).
  const res = await upstream(ENDPOINTS.courseDetail, {
    query: { PublicId: giCourseId },
  });
  const reqId = res.headers.get("x-request-id") ?? res.headers.get("x-correlation-id");
  console.log(`[golfintel-proxy] course-detail cache MISS id=${giCourseId} status=${res.status} reqId=${reqId ?? "-"} credits=1`);
  if (!res.ok) return { __error: mapUpstreamError(res.status) };
  const payload = await res.json();
  const fields = extractCourseFields(payload);
  const now = new Date().toISOString();
  const row = {
    gi_course_id: giCourseId,
    name: fields.name,
    city: fields.city,
    state: fields.state,
    country: fields.country,
    latitude: fields.latitude,
    longitude: fields.longitude,
    detail: payload,
    scorecard: fields.scorecard,
    gps: fields.gps,
    detail_fetched_at: now,
    scorecard_fetched_at: fields.scorecard ? now : null,
    gps_fetched_at: fields.gps ? now : null,
  };
  const { data: upserted } = await admin.from("gi_courses").upsert(row, { onConflict: "gi_course_id" }).select().single();
  await logCredit("course_detail", giCourseId);
  return { source: "live", course: upserted };
}

// Scorecard and GPS are served from the cached Course Group Detail payload.
// No separate upstream call — 0 additional credits.
async function actionSubPayload(giCourseId: string, kind: "scorecard" | "gps") {
  if (!giCourseId) return { __error: { code: "bad_request", status: 400 } };
  const col = kind === "scorecard" ? "scorecard" : "gps";
  const stamp = kind === "scorecard" ? "scorecard_fetched_at" : "gps_fetched_at";
  const { data: cached } = await admin.from("gi_courses").select("*").eq("gi_course_id", giCourseId).maybeSingle();
  if (cached?.[col]) {
    console.log(`[golfintel-proxy] ${kind} cache HIT id=${giCourseId}`);
    return { source: "cache", [kind]: cached[col] };
  }
  // Try slicing from cached course detail first (0 upstream calls).
  if (cached?.detail) {
    const slice = extractCourseFields(cached.detail)[col];
    if (slice) {
      await admin.from("gi_courses").update({ [col]: slice, [stamp]: new Date().toISOString() })
        .eq("gi_course_id", giCourseId);
      console.log(`[golfintel-proxy] ${kind} sliced from cached detail id=${giCourseId}`);
      return { source: "cache", [kind]: slice };
    }
  }
  // Confirmed dedicated endpoint (free — sub-resource of an already-paid detail).
  const path = kind === "scorecard" ? ENDPOINTS.scorecard : ENDPOINTS.gps;
  const res = await upstream(path, { query: { PublicId: giCourseId } });
  const reqId = res.headers.get("x-request-id") ?? res.headers.get("x-correlation-id");
  console.log(`[golfintel-proxy] ${kind} upstream status=${res.status} reqId=${reqId ?? "-"} id=${giCourseId}`);
  if (!res.ok) return { __error: mapUpstreamError(res.status) };
  const payload = await res.json().catch(() => null);
  await admin.from("gi_courses").upsert(
    { gi_course_id: giCourseId, [col]: payload, [stamp]: new Date().toISOString() },
    { onConflict: "gi_course_id" },
  );
  return { source: "live", [kind]: payload };
}

async function signedAssetUrl(path: string) {
  const { data } = await admin.storage.from("gi-assets").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

// Walk cached GPS/Detail payload to map a course + human hole number -> upstream integer holeId.
async function resolveHoleId(giCourseId: string, holeNumber: number): Promise<number | null> {
  const { data: cached } = await admin.from("gi_courses").select("gps,detail")
    .eq("gi_course_id", giCourseId).maybeSingle();
  const sources = [cached?.gps, cached?.detail].filter(Boolean);
  const stack: unknown[] = [...sources];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (Array.isArray(node)) { for (const n of node) stack.push(n); continue; }
    if (typeof node === "object") {
      const rec = node as Record<string, unknown>;
      const num = rec.holeNumber ?? rec.HoleNumber ?? rec.number ?? rec.Number;
      const id = rec.holeId ?? rec.HoleId ?? rec.id ?? rec.Id;
      if (typeof num === "number" && Number(num) === holeNumber && typeof id === "number") return id as number;
      for (const v of Object.values(rec)) if (v && typeof v === "object") stack.push(v);
    }
  }
  return null;
}

async function actionHoleAsset(giCourseId: string, holeNumber: number, assetType: "green_slope" | "elevation") {
  const { data: cached } = await admin.from("gi_hole_assets").select("*")
    .eq("gi_course_id", giCourseId).eq("hole_number", holeNumber).eq("asset_type", assetType).maybeSingle();
  if (cached) {
    const url = cached.storage_path ? await signedAssetUrl(cached.storage_path) : null;
    return { source: "cache", url, payload: cached.payload };
  }
  // Swagger requires the internal integer holeId. Resolve it from cached GPS/Detail.
  const holeId = await resolveHoleId(giCourseId, holeNumber);
  if (!holeId) return { __error: { code: "hole_id_unresolved", status: 422 } };
  const path = assetType === "green_slope" ? ENDPOINTS.greenSlope : ENDPOINTS.elevation;
  const res = await upstream(path, {
    query: { holeId: String(holeId), imageSizeType: "Large" },
  });
  const reqId = res.headers.get("x-request-id") ?? res.headers.get("x-correlation-id");
  console.log(`[golfintel-proxy] ${assetType} cache MISS id=${giCourseId} hole=${holeNumber} status=${res.status} reqId=${reqId ?? "-"} credits=1`);
  if (!res.ok) return { __error: mapUpstreamError(res.status) };
  const ct = res.headers.get("content-type") ?? "";
  let storage_path: string | null = null;
  let payload: unknown = null;
  if (ct.startsWith("image/")) {
    const buf = new Uint8Array(await res.arrayBuffer());
    const ext = ct.includes("png") ? "png" : ct.includes("jpeg") ? "jpg" : "bin";
    storage_path = `gi/${giCourseId}/${holeNumber}-${assetType}.${ext}`;
    await admin.storage.from("gi-assets").upload(storage_path, buf, { contentType: ct, upsert: true });
  } else {
    payload = await res.json().catch(() => null);
  }
  await admin.from("gi_hole_assets").insert({
    gi_course_id: giCourseId, hole_number: holeNumber, asset_type: assetType, storage_path, payload,
  });
  await logCredit(assetType, giCourseId, holeNumber);
  const url = storage_path ? await signedAssetUrl(storage_path) : null;
  return { source: "live", url, payload };
}

async function actionCreditStatus() {
  const { data } = await admin.from("gi_credit_log").select("credits_estimated");
  const used = (data ?? []).reduce((s, r) => s + Number((r as any).credits_estimated ?? 0), 0);
  return { used, limit: 50, remaining: Math.max(0, 50 - used) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const userId = await requireUser(req);
    if (!userId) return j(401, { error: "unauthorized" });
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;
    let result: any;
    switch (action) {
      case "search":
        result = await actionSearch(String(body.query ?? ""), {
          countryCode: body.countryCode ? String(body.countryCode) : undefined,
          rows: body.rows ? Number(body.rows) : undefined,
          offset: body.offset ? Number(body.offset) : undefined,
        });
        break;
      case "course-detail":
        result = await actionCourseDetail(String(body.giCourseId ?? ""));
        break;
      case "scorecard":
        result = await actionSubPayload(String(body.giCourseId ?? ""), "scorecard");
        break;
      case "gps":
        result = await actionSubPayload(String(body.giCourseId ?? ""), "gps");
        break;
      case "hole-asset":
        result = await actionHoleAsset(
          String(body.giCourseId ?? ""),
          Number(body.holeNumber),
          body.assetType === "elevation" ? "elevation" : "green_slope",
        );
        break;
      case "credit-status":
        result = await actionCreditStatus();
        break;
      case "validate": {
        // Owner-runnable end-to-end validation with Sharjah Golf & Shooting Club.
        result = await actionValidate();
        break;
      }
      default:
        return j(400, { error: "unknown_action" });
    }
    if (result?.__error) return j(result.__error.status, { error: result.__error.code });
    return j(200, result);
  } catch (e) {
    console.error("golfintel-proxy error", e);
    return j(500, { error: "internal" });
  }
});