## Goal

Make Course Mapping feel like a natural extension of Live GPS. A golfer who lands on an unmapped course (or hole) starts mapping in one tap, completes a hole, and is returned to Live GPS with the new Premium hole already rendered — no menu hopping, no re-selection.

## Scope & decisions to confirm

1. **Who can map?** The current build restricts the Course Mapper to the owner email (via `MembershipGate featureKey="course.mapper"` + owner-only buttons in `GpsMap.tsx` / `PremiumHoleRenderer.tsx`). The "community-driven mapping ecosystem" line in your brief implies opening this up. Two options:
   - **A. Owner-only (current)** — wire the integrated workflow but keep the gate. Safer, no abuse risk.
   - **B. Any signed-in user** — drop the `MembershipGate` on `/gswing/course-mapper`, drop the `isOwner` checks on the Premium prompts. Adds a moderation/verification surface later.
   I'll default to **A** unless you say otherwise.

2. **Hole-level vs course-level detection.** I'll treat a hole as "mapped" when `gswing_mapped_holes` has a row AND `gswing_premium-readiness` reports the hole has tee + green + (fairway OR `na_marker`). The course is "fully mapped" when every hole in `golf_holes` for that course has a mapped row.

## What changes

### 1. Detection & state (Live GPS)

`src/components/gswing/GpsMap.tsx`
- Add a `useMemo`/effect that produces:
  ```ts
  { courseMapped: boolean; holeMapped: boolean; mappedCount: number; totalHoles: number; missingHoles: number[] }
  ```
  derived from `mappedHole` (current hole), the existing course-map loader, and `golf_holes` count.
- Pass this down as a single `mappingStatus` prop to the Premium overlay and renderer.

### 2. "Course Mapping Required" premium overlay

New component `src/components/gswing/gps/MappingRequiredOverlay.tsx`
- Rendered inside `PremiumHoleRenderer` (replaces the current owner-only `OwnerMappingActions` block) when `holeMapped === false` AND `mapView === "premium"`.
- Shows: title, subtitle (course vs hole missing), two buttons:
  - **Start Mapping** → calls `onStartMapping(hole)`
  - **Continue with Satellite Only** → calls `onSetMapView("satellite")`
- Glass-morphism styling matching `PremiumGpsOverlay` (Sora/Manrope, gold gradient).

### 3. One-tap launch with full context

`GpsMap.tsx` — extend the existing `navigateToCourseMapper` helper:
- Build query string with `courseId`, `course` (name), `hole`, `lat`, `lng`, `units`, `returnTo=gps`.
- Drop the `if (!membership.isOwner) return` guard if option **B** is chosen.

`src/pages/GswingCourseMapper.tsx`
- Read query params; pass them as initial props to `CourseMapper`.
- (Option **B**: remove `MembershipGate`.)

`src/components/gswing/admin/CourseMapper.tsx`
- Accept new optional props: `initialCourseId`, `initialCourseName`, `initialHole`, `initialLat/Lng`, `initialUnits`, `returnTo`.
- On mount, if `initialCourseId` is set, skip the course-picker step and jump straight into the workspace at the requested hole.
- After a successful `Save Hole` (existing save handler), if `returnTo === "gps"` → `navigate("/?view=gps&hole=<n>&refreshMap=1")` instead of staying in the mapper.

### 4. Instant refresh in Live GPS

`GpsMap.tsx`
- On mount / location change, if URL has `refreshMap=1`, invalidate the course-map cache for the current course and re-fetch only the affected hole, then strip the param via `replaceState`. No full reload.
- The existing `mappedHole` query already drives the Premium renderer — a single re-fetch is enough for it to repaint.

### 5. Floating "Map Course" FAB + progress chip

`src/components/gswing/gps/PremiumGpsOverlay.tsx`
- New floating chip top-right (under the top status rail) shown when `mappingStatus.courseMapped === false`:
  ```
  ✨ Premium Mapping   16 / 18
  ```
  Tapping it opens the same Start Mapping flow scoped to the **next missing hole** (or current hole if it is missing).
- Hide the chip when `courseMapped === true`; briefly show a "Premium GPS Ready ✓ 18/18" toast on the transition.

### 6. Hole skip prompt

When the *current* hole is mapped but *some other* hole is missing AND the user just arrived from Course Mapper, show a small bottom sheet: "Hole N still needs mapping — Map now / Skip". Reuses the same overlay buttons.

### 7. Smart "you're on an unmapped course" prompt

In `GpsMap.tsx`, when course resolution via nearest-course detection succeeds but no `golf_courses` row + no `gswing_course_maps` exists, surface a one-time toast (sonner) with action: "Map this course" → routes to `/gswing/course-mapper?lat=…&lng=…&new=1`. `CourseMapper` already supports creating a new course; we'll just wire the `new=1` shortcut to land on its create-course screen.

## Files touched

- `src/components/gswing/GpsMap.tsx` — detection, query param plumbing, refresh-on-return, smart toast.
- `src/components/gswing/gps/PremiumHoleRenderer.tsx` — wire `MappingRequiredOverlay`, remove owner-only fork.
- `src/components/gswing/gps/PremiumGpsOverlay.tsx` — progress chip / FAB.
- `src/components/gswing/gps/MappingRequiredOverlay.tsx` — NEW.
- `src/components/gswing/admin/CourseMapper.tsx` — accept initial context props, skip picker, post-save return-to-GPS.
- `src/pages/GswingCourseMapper.tsx` — pass query params, optionally drop `MembershipGate`.
- `src/lib/gswing-premium-readiness.ts` — small helper `courseReadinessSummary(courseId)` if not already present.

No DB schema changes. No edge function changes.

## Open questions

1. **Option A (owner-only) or Option B (any signed-in user) for mapping access?** Defaulting to A.
2. **"Smart detection" toast** — only when GPS accuracy ≤ 50 m, or always when a nearby unmapped course is detected? Defaulting to ≤ 50 m to avoid noise.

Reply "go" to build with the defaults, or tell me which to flip.
