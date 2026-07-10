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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function upstream(path: string, init: { method?: string; query?: Record<string, string>; body?: unknown } = {}) {
  if (!BASE_URL || !TOKEN) throw new Error("upstream_not_configured");
  const url = new URL(BASE_URL.replace(/\/$/, "") + path);
  if (init.query) for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  // Include client id as header AND query param; upstream will accept whichever it uses.
  if (CLIENT_ID) url.searchParams.set("client_id", CLIENT_ID);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url.toString(), {
      method: init.method ?? "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "X-Client-Id": CLIENT_ID,
        "Content-Type": "application/json",
        Accept: "application/json,image/*",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
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

async function actionSearch(query: string) {
  if (!query || query.trim().length < 2) return { results: [] };
  SEARCH_CALLS += 1;
  // POST per Swagger: /courses/searchCourseGroups
  // Body shape per Swagger BLL.Courses.PublicCourseGroupSearchRequestDto.
  const res = await upstream(ENDPOINTS.search, {
    method: "POST",
    body: { keywords: query, rows: 25, offset: 0 },
  });
  const reqId = res.headers.get("x-request-id") ?? res.headers.get("x-correlation-id");
  console.log(`[golfintel-proxy] search status=${res.status} calls=${SEARCH_CALLS} reqId=${reqId ?? "-"} q="${query}"`);
  if (!res.ok) return { __error: mapUpstreamError(res.status) };
  const data = await res.json().catch(() => ({}));
  // Response: CourseGroupSearchResultsDto { rows: CourseGroupSearchDto[] }.
  const raw = Array.isArray(data)
    ? data
    : data.rows ?? data.results ?? data.courseGroups ?? data.data ?? [];
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
        result = await actionSearch(String(body.query ?? ""));
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