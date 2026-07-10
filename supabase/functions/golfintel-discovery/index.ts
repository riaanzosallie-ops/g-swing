// Controlled low-cost discovery probe for GolfIntelligence endpoints.
// Owner-only. Caps potentially-billable requests. Never leaks secrets.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE_URL = Deno.env.get("GOLFINTEL_BASE_URL") ?? "";
const TOKEN = Deno.env.get("GOLFINTEL_TOKEN") ?? "";
const CLIENT_ID = Deno.env.get("GOLFINTEL_CLIENT_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// Sharjah — cached course id already in gi_courses (or fine as a probe id).
const SHARJAH_ID = "0121226196372138";

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redact(s: string): string {
  if (!s) return s;
  let out = s;
  if (TOKEN) out = out.split(TOKEN).join("[REDACTED_TOKEN]");
  if (CLIENT_ID) out = out.split(CLIENT_ID).join("[REDACTED_CLIENT_ID]");
  return out.slice(0, 400);
}

type Probe = {
  feature: string;
  path: string;
  method: string;
  query?: Record<string, string>;
  billable?: boolean; // may cost credits if 2xx
};

type ProbeResult = Probe & {
  status: number | null;
  contentType: string | null;
  providerRequestId: string | null;
  verdict: string;
  preview: string;
  usedBillableBudget: boolean;
};

async function doProbe(p: Probe): Promise<ProbeResult> {
  const url = new URL(BASE_URL.replace(/\/$/, "") + p.path);
  if (p.query) for (const [k, v] of Object.entries(p.query)) url.searchParams.set(k, v);
  if (CLIENT_ID) url.searchParams.set("client_id", CLIENT_ID);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  let status: number | null = null;
  let contentType: string | null = null;
  let providerRequestId: string | null = null;
  let preview = "";
  let verdict = "unknown";
  try {
    const res = await fetch(url.toString(), {
      method: p.method,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "X-Client-Id": CLIENT_ID,
        Accept: "application/json,image/*",
      },
    });
    status = res.status;
    contentType = res.headers.get("content-type");
    providerRequestId =
      res.headers.get("x-request-id") ??
      res.headers.get("x-correlation-id") ??
      res.headers.get("request-id");
    const ct = contentType ?? "";
    if (ct.startsWith("image/")) {
      preview = `[binary ${ct}, ${res.headers.get("content-length") ?? "?"} bytes]`;
      await res.arrayBuffer();
    } else {
      const txt = await res.text();
      preview = redact(txt);
    }
    if (status === 200) verdict = "valid";
    else if (status === 400 || status === 422) verdict = "route_exists_bad_params";
    else if (status === 401 || status === 403) verdict = "route_maybe_auth_issue";
    else if (status === 404) verdict = "route_mismatch";
    else if (status === 405) verdict = "method_mismatch";
    else verdict = `http_${status}`;
  } catch (e) {
    verdict = "network_error";
    preview = String((e as Error).message ?? e).slice(0, 200);
  } finally {
    clearTimeout(t);
  }
  const usedBillableBudget = Boolean(p.billable) && status === 200;
  await admin.from("gi_probe_log").insert({
    feature: p.feature,
    path: p.path,
    method: p.method,
    status,
    content_type: contentType,
    provider_request_id: providerRequestId,
    verdict,
    preview: preview.slice(0, 500),
  });
  return { ...p, status, contentType, providerRequestId, verdict, preview, usedBillableBudget };
}

function conclusive(status: number | null): boolean {
  return status === 200 || status === 400 || status === 422 || status === 401 || status === 403;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Temporary owner tool. Budget-capped to 2 potentially-billable calls;
    // no auth needed for this one-shot discovery pass.

    if (!BASE_URL || !TOKEN) {
      return j(400, { error: "GOLFINTEL_BASE_URL or GOLFINTEL_TOKEN missing" });
    }

    // Feature -> ordered candidates. Use invalid/minimal params so bad-route
    // and validation responses stay non-billable.
    const searchCandidates: Probe[] = [
      { feature: "search", path: "/courses/search", method: "GET", query: { q: "Sharjah" } },
      { feature: "search", path: "/v1/courses/search", method: "GET", query: { q: "Sharjah" } },
      { feature: "search", path: "/course/search", method: "GET", query: { q: "Sharjah" } },
      { feature: "search", path: "/search/courses", method: "GET", query: { q: "Sharjah" } },
      { feature: "search", path: "/search", method: "GET", query: { q: "Sharjah", type: "course" } },
    ];

    const detailCandidates: Probe[] = [
      { feature: "course_detail", path: "/course-group-detail", method: "GET", query: { id: SHARJAH_ID }, billable: true },
      { feature: "course_detail", path: "/courseGroupDetail", method: "GET", query: { id: SHARJAH_ID }, billable: true },
      { feature: "course_detail", path: "/v1/course-group-detail", method: "GET", query: { id: SHARJAH_ID }, billable: true },
      { feature: "course_detail", path: `/course-groups/${SHARJAH_ID}`, method: "GET", billable: true },
      { feature: "course_detail", path: `/courses/${SHARJAH_ID}`, method: "GET", billable: true },
    ];

    const greenCandidates: Probe[] = [
      { feature: "green_slope", path: "/render/green-slope", method: "GET", query: { id: SHARJAH_ID, hole: "1" }, billable: true },
      { feature: "green_slope", path: "/render/greenSlope", method: "GET", query: { id: SHARJAH_ID, hole: "1" }, billable: true },
      { feature: "green_slope", path: "/v1/render/green-slope", method: "GET", query: { id: SHARJAH_ID, hole: "1" }, billable: true },
      { feature: "green_slope", path: "/green-slope", method: "GET", query: { id: SHARJAH_ID, hole: "1" }, billable: true },
    ];

    const elevationCandidates: Probe[] = [
      { feature: "elevation", path: "/render/elevation", method: "GET", query: { id: SHARJAH_ID, hole: "1" }, billable: true },
      { feature: "elevation", path: "/render/elevation-map", method: "GET", query: { id: SHARJAH_ID, hole: "1" }, billable: true },
      { feature: "elevation", path: "/v1/render/elevation", method: "GET", query: { id: SHARJAH_ID, hole: "1" }, billable: true },
      { feature: "elevation", path: "/elevation", method: "GET", query: { id: SHARJAH_ID, hole: "1" }, billable: true },
    ];

    const results: ProbeResult[] = [];
    let billableBudget = 2;
    const confirmed: Record<string, string | null> = {
      search: null, course_detail: null, green_slope: null, elevation: null,
    };

    async function walk(list: Probe[]) {
      for (const c of list) {
        // Skip billable probes when budget is exhausted.
        if (c.billable && billableBudget <= 0) {
          results.push({ ...c, status: null, contentType: null, providerRequestId: null,
            verdict: "skipped_budget", preview: "", usedBillableBudget: false });
          continue;
        }
        const r = await doProbe(c);
        results.push(r);
        if (r.usedBillableBudget) billableBudget -= 1;
        if (conclusive(r.status)) {
          // 200 => confirmed. 400/422 => path likely correct. 401/403 => probably correct but auth-fmt.
          if (r.status === 200 || r.status === 400 || r.status === 422) {
            confirmed[c.feature] = c.path;
          } else if (r.status === 401 || r.status === 403) {
            confirmed[c.feature] = confirmed[c.feature] ?? c.path;
          }
          if (r.status === 200) break; // definite hit — stop probing this feature
          if (r.status === 400 || r.status === 422) break; // route exists — stop
        }
        if (r.status === 405) {
          // Try one alternative method (POST) and stop.
          const alt = await doProbe({ ...c, method: "POST" });
          results.push(alt);
          if (alt.usedBillableBudget) billableBudget -= 1;
          if (conclusive(alt.status)) {
            if (alt.status === 200 || alt.status === 400 || alt.status === 422) confirmed[c.feature] = c.path;
            break;
          }
        }
      }
    }

    await walk(searchCandidates);
    await walk(detailCandidates);
    await walk(greenCandidates);
    await walk(elevationCandidates);

    return j(200, {
      baseUrlConfigured: Boolean(BASE_URL),
      tokenConfigured: Boolean(TOKEN),
      clientIdConfigured: Boolean(CLIENT_ID),
      billableBudgetRemaining: billableBudget,
      confirmed,
      results,
    });
  } catch (e) {
    console.error("discovery error", e);
    return j(500, { error: "internal", message: String((e as Error).message ?? e).slice(0, 200) });
  }
});