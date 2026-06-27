// G-Swing → GolfCourseAPI proxy.
// Server-only Edge Function. Holds GOLFCOURSE_API_KEY and exposes a small
// normalised JSON surface to the client. Auth-gated to signed-in users; the
// "sync" action additionally requires an owner/platform_owner/admin role.
//
// Actions (POST body { action, ...params }):
//   - "search"   { query: string }
//   - "get"      { id: number | string }
//   - "sharjah"  {}                     (search for Sharjah Golf and Shooting Club)
//
// 24h in-memory cache per worker. The API key is never returned to the client.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const API_BASE = "https://api.golfcourseapi.com/v1";
const API_KEY = Deno.env.get("GOLFCOURSE_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

console.log(`[golfcourse-api] boot — API key found = ${API_KEY.length > 0}`);

type CacheEntry = { value: unknown; expires: number };
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}
function putCache(key: string, value: unknown) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

async function callApi(path: string): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string }> {
  if (!API_KEY) {
    console.error("[golfcourse-api] GOLFCOURSE_API_KEY secret is missing");
    return { ok: false, status: 500, error: "GOLFCOURSE_API_KEY not configured on server" };
  }
  const url = `${API_BASE}${path}`;
  const headers = { Authorization: `Key ${API_KEY}`, Accept: "application/json" };
  console.log("[golfcourse-api] GolfCourseAPI Request", {
    url,
    method: "GET",
    headers: { Authorization: "Key <REDACTED>", Accept: headers.Accept },
  });
  const res = await fetch(url, { headers });
  const text = await res.text();
  console.log("[golfcourse-api] GolfCourseAPI Response", {
    status: res.status,
    bodyPreview: text.slice(0, 500),
  });
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    const providerErr = (parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>))
      ? String((parsed as Record<string, unknown>).error)
      : (text || `HTTP ${res.status}`);
    const labelled = `${res.status} ${providerErr}`;
    console.error("[golfcourse-api] GolfCourseAPI Error", { status: res.status, error: labelled });
    return { ok: false, status: res.status, error: labelled };
  }
  return { ok: true, data: parsed };
}

function json(body: unknown, status = 200) {
  // Always return 200 to the client so supabase-js does not collapse the
  // body into a generic "non-2xx" error. Real status is in body.providerStatus.
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorJson(error: string, providerStatus: number) {
  return json({ error, providerStatus, fallback: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return errorJson("Invalid JSON body", 400); }
  const action = String(body.action ?? "");

  // "health" is an unauthenticated diagnostic so owners can verify
  // provider connectivity without a session. Every other action requires
  // a valid caller token.
  if (action !== "health") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorJson("Unauthorized: missing caller token", 401);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return errorJson("Unauthorized: invalid caller token", 401);
  }

  try {
    if (action === "search") {
      const query = String(body.query ?? "").trim();
      if (!query) return errorJson("query required", 400);
      const key = `search:${query.toLowerCase()}`;
      const hit = cached<unknown>(key);
      if (hit) return json({ cached: true, ...(hit as object) });
      const r = await callApi(`/search?search_query=${encodeURIComponent(query)}`);
      if (!r.ok) return errorJson(r.error, r.status);
      putCache(key, r.data);
      return json({ cached: false, ...(r.data as object) });
    }

    if (action === "get") {
      const id = body.id;
      if (id === undefined || id === null) return errorJson("id required", 400);
      const key = `course:${id}`;
      const hit = cached<unknown>(key);
      if (hit) return json({ cached: true, course: hit });
      const r = await callApi(`/courses/${encodeURIComponent(String(id))}`);
      if (!r.ok) return errorJson(r.error, r.status);
      putCache(key, r.data);
      return json({ cached: false, course: r.data });
    }

    if (action === "sharjah") {
      // Try primary, then progressively broader UAE searches and merge.
      const queries = [
        "Sharjah Golf and Shooting Club",
        "Sharjah",
        "United Arab Emirates",
        "Dubai",
        "Abu Dhabi",
      ];
      const merged: { id: unknown; club_name?: string; course_name?: string; location?: unknown; _query: string }[] = [];
      const seen = new Set<string>();
      let lastError: { status: number; error: string } | null = null;
      for (const q of queries) {
        const r = await callApi(`/search?search_query=${encodeURIComponent(q)}`);
        if (!r.ok) { lastError = { status: r.status, error: r.error }; continue; }
        const list = ((r.data as { courses?: Array<Record<string, unknown>> })?.courses ?? []);
        for (const c of list) {
          const id = String((c as { id?: unknown }).id ?? "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          merged.push({ ...(c as Record<string, unknown>), _query: q } as never);
        }
        // Stop early if specific Sharjah club found
        if (q === queries[0] && list.length > 0) break;
      }
      if (merged.length === 0 && lastError) return errorJson(lastError.error, lastError.status);
      return json({ cached: false, courses: merged, queriesTried: queries });
    }

    if (action === "health") {
      const r = await callApi(`/search?search_query=pinehurst`);
      return json({
        ok: r.ok,
        hasKey: API_KEY.length > 0,
        endpoint: `${API_BASE}/search`,
        authHeader: "Authorization: Key <REDACTED>",
        providerStatus: r.ok ? 200 : r.status,
        providerError: r.ok ? null : r.error,
      });
    }

    return errorJson(`Unknown action: ${action}`, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[golfcourse-api] Unhandled error", msg);
    return errorJson(msg, 500);
  }
});