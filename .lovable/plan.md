
# GolfAPI.io Sole-Provider Migration

Goal: GolfAPI.io becomes the only course-data source. Key stays in Supabase. Frontend never calls the vendor. Mapbox/Esri basemap tiles are removed; OSM owner-only assist stays.

---

## 1. Backend — Edge Function proxy (`golf-api`)

Replace the existing `golfcourse-api` function with a new `golf-api` proxy:

- Reads `GOLF_API_KEY` from `Deno.env`. Sends `Authorization: Key <GOLF_API_KEY>` to `https://api.golfapi.io/v2.3` (base per docs).
- Actions (single POST, `{action, ...params}`):
  - `search` → `GET /clubs` with `name`/`country`/`state`/`city`.
  - `club`   → `GET /clubs/{id}` (returns club + courses list).
  - `course` → `GET /courses/{id}` (full course incl. holes + tees + coords).
  - `health` → HEAD/GET `/clubs?name=test` for the admin Test Connection button.
- Every call is logged to `golf_api_logs` (endpoint, params, status, latency, error).
- Course responses are upserted into cache tables before returning.
- Response shape normalised so the frontend receives one consistent schema.

## 2. Database migration

Wipe legacy course cache, add clean tables:

- Truncate: `gswing_course_maps`, `gswing_mapped_holes`, `gswing_hole_features`, `golf_courses`, `golf_holes`, `golf_hazards`, `golf_green_polygons`, `golf_fairway_polygons`, `golf_hole_points`, `golf_daily_pins`, `course_sync_history`.
- New tables (all with GRANTs + RLS):
  - `golfapi_clubs` — cached club metadata (id, name, city, country, coords, raw).
  - `golfapi_courses` — cached course (club_id, name, num_holes, coords, raw, cached_at, ttl).
  - `golfapi_holes` — per-hole par/index/distances/coords.
  - `golfapi_tees` — per-tee name/gender/rating/slope/total.
  - `golfapi_green_coords` / `golfapi_hazards` — populated only when supplied.
  - `golf_api_logs` — request log (owner-read via `has_role admin`).
  - `golf_api_cache_meta` — key/value cache stats.
- RLS: read = authenticated; write = service_role only (edge function).

## 3. Frontend — provider layer

- New `src/lib/golfapi/client.ts`: thin wrapper around `supabase.functions.invoke("golf-api", …)`. Handles cache-first read from Supabase, then live fetch when stale.
- Replace all imports of `@/lib/golfcourse-api` and `@/lib/course-providers/*` with the new client.
- Delete:
  - `src/lib/course-providers/` (whole folder)
  - `src/lib/golfcourse-api.ts`
  - `src/lib/satellite-providers.ts`
  - `src/lib/mapbox-course-layers.ts`, `mapbox-mapped-layers.ts`, `mapbox-shot-overlay.ts`, `mapbox-static.ts`
  - `supabase/functions/golfcourse-api/`
  - `supabase/functions/mapbox-token/`
- Uninstall `mapbox-gl`.
- Keep `src/lib/gswing-osm-overpass.ts` + `OsmScanPanel` (owner-only assist, per your choice).

## 4. Map surface — no basemap tiles

`GpsMap.tsx` is rebuilt around the existing `PremiumHoleRenderer` (SVG on emerald canvas):

- Removes Mapbox init, style swaps, provider chain, satellite/premium toggle, tap-to-measure on tiles.
- Premium SVG hole rendering + real-world haversine tap-to-measure using projected coords.
- Course Mapper keeps its Esri fallback removed too — it becomes an emerald grid canvas with manual placement using GPS coords from GolfAPI.io. (Confirming this in the technical notes since it's a meaningful UX change.)

## 5. Admin — Settings → Golf API

New page `src/pages/GolfApiSettings.tsx` + route `/gswing/golf-api`, owner-only:

- Connection status, Test Connection, Last Sync, Search Club, Sync Club, Sync Course, Sync All Cached, API Response viewer, Cache Stats, Force Refresh, log viewer (last 100 calls).

Replaces `GolfCourseApiSyncPanel` + `ManageCourses` GolfCourseAPI bits.

## 6. Cleanup & validation

- Remove all references to `GolfCourseAPI`, `iGolf`, `GolfIntelligence`, `SATELLITE_PROVIDER_CHAIN`, `mapbox-token` edge fn, `VITE_MAPBOX_ACCESS_TOKEN`.
- Update `useGswingMembership` feature keys if any name changes.
- `tsgo` + `eslint` clean.
- Manual smoke: search a club → open course → see holes → open Live GPS → tap measure works.

---

## Technical notes

- Base URL & response schema will be read from https://golfapi.io/docs; if a documented field is missing (e.g. hazards), it's stored as null and marked "unavailable" in the admin panel — no fabricated data.
- Cache TTL default: 30 days for courses, 7 days for club search. Overridable per row.
- The GOLF_API_KEY secret is already saved and only readable from the edge function; the anon/publishable keys stay client-side (safe by design).
- Removing Mapbox means the Live GPS view no longer shows real satellite imagery. The Premium SVG hole renderer becomes the sole map surface. Course Mapper loses its satellite drawing aid — geometry will be drawn on the emerald canvas using GolfAPI.io GPS coordinates as anchors. If you want satellite imagery back later, we can reintroduce a single tile provider without changing this migration.

## Deliverables report (produced after implementation)

Files deleted, files modified, new edge functions, migrations run, providers removed, dead-code sweep summary, and an architecture diagram confirming GolfAPI.io → Edge Function → Supabase Cache → Frontend is the only data path.
