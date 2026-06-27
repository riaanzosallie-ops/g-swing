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
  if (!API_KEY) return { ok: false, status: 500, error: "GOLFCOURSE_API_KEY not configured" };
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Key ${API_KEY}`, Accept: "application/json" },
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    const err = (parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>))
      ? String((parsed as Record<string, unknown>).error)
      : `Provider error ${res.status}`;
    return { ok: false, status: res.status, error: err };
  }
  return { ok: true, data: parsed };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body.action ?? "");

  try {
    if (action === "search") {
      const query = String(body.query ?? "").trim();
      if (!query) return json({ error: "query required" }, 400);
      const key = `search:${query.toLowerCase()}`;
      const hit = cached<unknown>(key);
      if (hit) return json({ cached: true, ...(hit as object) });
      const r = await callApi(`/search?search_query=${encodeURIComponent(query)}`);
      if (!r.ok) return json({ error: r.error }, r.status);
      putCache(key, r.data);
      return json({ cached: false, ...(r.data as object) });
    }

    if (action === "get") {
      const id = body.id;
      if (id === undefined || id === null) return json({ error: "id required" }, 400);
      const key = `course:${id}`;
      const hit = cached<unknown>(key);
      if (hit) return json({ cached: true, course: hit });
      const r = await callApi(`/courses/${encodeURIComponent(String(id))}`);
      if (!r.ok) return json({ error: r.error }, r.status);
      putCache(key, r.data);
      return json({ cached: false, course: r.data });
    }

    if (action === "sharjah") {
      const key = `search:sharjah-golf-and-shooting-club`;
      const hit = cached<unknown>(key);
      if (hit) return json({ cached: true, ...(hit as object) });
      const r = await callApi(`/search?search_query=${encodeURIComponent("Sharjah Golf and Shooting Club")}`);
      if (!r.ok) return json({ error: r.error }, r.status);
      putCache(key, r.data);
      return json({ cached: false, ...(r.data as object) });
    }

    if (action === "health") {
      return json({ ok: true, hasKey: API_KEY.length > 0 });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});