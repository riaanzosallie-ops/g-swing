# Golf GPS API Reference

All endpoints are Supabase Edge Functions.  
Base URL: `https://<project>.supabase.co/functions/v1/`  
Auth header: `Authorization: Bearer <VITE_SUPABASE_PUBLISHABLE_KEY>`

---

## Courses

### `GET /golf-courses`
List all courses.

**Query params**
| Param | Type | Description |
|---|---|---|
| `country` | `AE` \| `ZA` \| … | Filter by ISO country code |

**Response**
```json
{ "courses": [ GolfCourse ] }
```

---

### `GET /golf-courses?lat=&lng=`
Find the nearest course to a GPS position.

**Query params:** `lat`, `lng` (both required)

**Response**
```json
{ "nearest": GolfCourse | null, "distance_meters": 432 }
```

---

### `GET /golf-courses/:id`
Single course metadata.

**Response**
```json
{ "course": GolfCourse }
```

---

### `GET /golf-courses/:id/holes`
All holes for a course (summary — tees + green centre only, no hazards).

**Response**
```json
{
  "course_id": "uuid",
  "holes": [
    {
      "id": "uuid",
      "hole_number": 1,
      "par": 4,
      "handicap": 11,
      "notes": "Dogleg left",
      "tee_boxes": [ { "color": "championship", "yardage": 413, "lat": 25.09, "lng": 55.15 } ],
      "greens": { "center": { "lat": 25.09, "lng": 55.15 }, "depth_yards": 30, "width_yards": 28 }
    }
  ]
}
```

---

### `GET /golf-courses/:id/holes/:num/gps`
Full GPS data for a single hole.  
Pass `lat`/`lng` to receive computed distances from the player's position.

**Query params**
| Param | Type | Default | Description |
|---|---|---|---|
| `lat` | number | — | Player latitude |
| `lng` | number | — | Player longitude |
| `unit` | `yards` \| `meters` | `yards` | Distance unit |

**Response (status: ok)**
```json
{
  "course_id": "uuid",
  "hole_number": 7,
  "par": 4,
  "handicap": 13,
  "notes": "Water right entire hole",
  "unit": "yards",
  "status": "ok",
  "tee_boxes": [
    { "color": "championship", "yardage": 382, "lat": 25.09620, "lng": 55.16420 },
    { "color": "white",        "yardage": 344, "lat": 25.09625, "lng": 55.16426 }
  ],
  "green": {
    "center": { "lat": 25.09380, "lng": 55.16100 },
    "front":  { "lat": 25.09369, "lng": 55.16103 },
    "back":   { "lat": 25.09391, "lng": 55.16097 },
    "pin":    { "lat": 25.09382, "lng": 55.16101 },
    "polygon": { "type": "Polygon", "coordinates": [[...]] },
    "depth_yards": 28,
    "width_yards": 26
  },
  "hazards": [
    {
      "type": "water",
      "label": "Water right entire hole",
      "lat": 25.09500, "lng": 55.16390,
      "geometry": null,
      "carry_yards_from_tee": null
    }
  ],
  "player_position": { "lat": 25.09500, "lng": 55.16300 },
  "distances": {
    "to_center_of_green": 158,
    "to_front_of_green":  146,
    "to_back_of_green":   170,
    "to_pin":             156,
    "to_tee_box":         240,
    "hazards": {
      "water_water_right_entire_hole": 48
    }
  },
  "recommended_target": "Short iron to flag"
}
```

**Response (no hole data)**
```json
{ "course_id": "uuid", "hole_number": 3, "status": "no_data", "message": "Hole GPS data not yet available for this course.", "distances": null }
```

---

## Rounds

### `POST /golf-rounds/start`
Begin a new round. Returns the created round.

**Body**
```json
{ "course_id": "uuid", "session_id": "client-uuid", "unit": "yards" }
```

**Response 201**
```json
{ "round": ActiveRound }
```

---

### `GET /golf-rounds/:id`
Full round state including per-hole scores and any open shot.

**Response**
```json
{
  "round": ActiveRound,
  "hole_states": [ HoleState ],
  "active_shot": Shot | null
}
```

---

### `PATCH /golf-rounds/:id/location`
Push the player's latest GPS position.  
The backend **auto-detects the nearest hole** and updates `current_hole` if it changed.

**Body**
```json
{ "lat": 25.09500, "lng": 55.16300 }
```

**Response**
```json
{
  "round": ActiveRound,
  "hole_changed": true,
  "nearest_hole": 7
}
```

---

### `PATCH /golf-rounds/:id/hole`
Manually navigate to a hole (1–18).

**Body**
```json
{ "hole_number": 8 }
```

**Response**
```json
{ "round": ActiveRound }
```

---

### `POST /golf-rounds/:id/shots/start`
Begin tracking a shot from the player's current GPS position.

**Body**
```json
{ "lat": 25.09620, "lng": 55.16420, "club_used": "7 Iron" }
```

**Response 201**
```json
{ "shot": Shot }
```

---

### `POST /golf-rounds/:id/shots/end`
Mark the shot as landed. Computes and stores `distance_yards` using haversine.

**Body**
```json
{ "lat": 25.09380, "lng": 55.16100, "shot_id": "optional-uuid" }
```
If `shot_id` is omitted, the most recent open shot for this round is used.

**Response**
```json
{ "shot": Shot, "distance_yards": 158 }
```

---

### `PATCH /golf-rounds/:id/score`
Upsert the score for a hole (idempotent).

**Body**
```json
{
  "hole_number": 7,
  "score": 4,
  "putts": 2,
  "fairway_hit": true,
  "gir": true,
  "notes": "Almost a birdie"
}
```

**Response**
```json
{ "hole_state": HoleState }
```

---

## Data Types

### `GolfCourse`
| Field | Type |
|---|---|
| `id` | `uuid` |
| `name` | `string` |
| `city` | `string` |
| `country` | `string` (ISO 3166-1 alpha-2) |
| `lat` / `lng` | `number` |
| `holes_count` | `number` |
| `par` | `number` |
| `website` | `string \| null` |
| `timezone` | `string` |

### `ActiveRound`
| Field | Type |
|---|---|
| `id` | `uuid` |
| `course_id` | `uuid` |
| `session_id` | `string` |
| `current_hole` | `number` |
| `player_lat` / `player_lng` | `number \| null` |
| `unit` | `"yards" \| "meters"` |
| `started_at` / `updated_at` | `ISO timestamp` |
| `completed_at` | `ISO timestamp \| null` |

### `HoleState`
| Field | Type |
|---|---|
| `hole_number` | `number` |
| `score` | `number \| null` |
| `putts` | `number \| null` |
| `fairway_hit` / `gir` | `boolean \| null` |

### `Shot`
| Field | Type |
|---|---|
| `id` | `uuid` |
| `hole_number` / `shot_number` | `number` |
| `start_lat` / `start_lng` | `number` |
| `end_lat` / `end_lng` | `number \| null` |
| `distance_yards` | `number \| null` |
| `club_used` | `string \| null` |

---

## Frontend Usage Example

```typescript
import {
  getOrCreateSessionId,
  fetchCourses,
  fetchHoleGps,
  startRound,
  updatePlayerLocation,
  startShot,
  endShot,
  saveHoleScore,
} from "@/lib/golf-gps-api";

// 1. List UAE courses
const uaeCourses = await fetchCourses("AE");

// 2. Start a round
const sessionId = getOrCreateSessionId();
const round = await startRound({ courseId: uaeCourses[0].id, sessionId, unit: "yards" });

// 3. Full hole GPS data (hole 7 with player position)
const holeData = await fetchHoleGps(round.course_id, 7, {
  playerPos: { lat: 25.09500, lng: 55.16300 },
  unit: "yards",
});
// holeData.distances.to_center_of_green → 158
// holeData.distances.to_front_of_green  → 146
// holeData.distances.to_back_of_green   → 170
// holeData.green.polygon                → GeoJSON shape for map rendering

// 4. Push live GPS position (auto-detects nearest hole)
const { hole_changed, nearest_hole } = await updatePlayerLocation(round.id, {
  lat: 25.09500, lng: 55.16300,
});

// 5. Track a shot
const shot = await startShot(round.id, { lat: 25.09620, lng: 55.16420 }, "7 Iron");
// ... player walks to ball ...
const { distance_yards } = await endShot(round.id, { lat: 25.09380, lng: 55.16100 });

// 6. Save scorecard
await saveHoleScore(round.id, { hole_number: 7, score: 4, putts: 2, gir: true });
```

---

## Apply to Supabase

```bash
# 1. Apply schema + seed via Supabase SQL editor, or:
supabase db push

# 2. Deploy edge functions
supabase functions deploy golf-courses
supabase functions deploy golf-rounds
```
