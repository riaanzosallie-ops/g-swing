-- Golf GPS Backend Schema
-- Run via: supabase db push  (or apply in Supabase SQL editor)

-- ─── Courses ────────────────────────────────────────────────────────────────
create table if not exists golf_courses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text not null,
  country     text not null,               -- ISO 3166-1 alpha-2: "AE", "ZA"
  lat         double precision not null,   -- course centre latitude
  lng         double precision not null,   -- course centre longitude
  holes_count int  not null default 18,
  par         int  not null default 72,
  website     text,
  timezone    text not null default 'UTC',
  created_at  timestamptz not null default now()
);

-- ─── Holes ──────────────────────────────────────────────────────────────────
create table if not exists course_holes (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references golf_courses(id) on delete cascade,
  hole_number int  not null check (hole_number between 1 and 18),
  par         int  not null check (par between 3 and 5),
  handicap    int  not null check (handicap between 1 and 18),
  notes       text,
  unique (course_id, hole_number)
);

create index if not exists idx_course_holes_course_id on course_holes(course_id);

-- ─── Tee Boxes ──────────────────────────────────────────────────────────────
-- Each hole can have multiple tee boxes (championship / white / red / yellow)
create table if not exists tee_boxes (
  id         uuid primary key default gen_random_uuid(),
  hole_id    uuid not null references course_holes(id) on delete cascade,
  color      text not null,               -- 'championship','blue','white','red','yellow'
  lat        double precision not null,
  lng        double precision not null,
  yardage    int  not null,               -- distance to green centre in yards
  unique (hole_id, color)
);

create index if not exists idx_tee_boxes_hole_id on tee_boxes(hole_id);

-- ─── Greens ─────────────────────────────────────────────────────────────────
create table if not exists greens (
  id            uuid primary key default gen_random_uuid(),
  hole_id       uuid not null references course_holes(id) on delete cascade,
  center_lat    double precision not null,
  center_lng    double precision not null,
  front_lat     double precision not null,    -- closest edge to tee
  front_lng     double precision not null,
  back_lat      double precision not null,    -- furthest edge from tee
  back_lng      double precision not null,
  pin_lat       double precision,             -- current pin position (nullable)
  pin_lng       double precision,
  polygon       jsonb,                        -- GeoJSON Polygon of green shape
  depth_yards   int not null default 30,
  width_yards   int not null default 28,
  unique (hole_id)
);

-- ─── Hazards ────────────────────────────────────────────────────────────────
create table if not exists hazards (
  id                  uuid primary key default gen_random_uuid(),
  hole_id             uuid not null references course_holes(id) on delete cascade,
  type                text not null check (type in ('bunker','water','dogleg','layup','ob','trees')),
  label               text,                   -- e.g. "Left greenside bunker"
  lat                 double precision,        -- centroid for point references
  lng                 double precision,
  geometry            jsonb,                   -- GeoJSON for polygon/line shapes
  carry_yards_from_tee int                     -- optional carry reference
);

create index if not exists idx_hazards_hole_id on hazards(hole_id);

-- ─── Active Rounds ──────────────────────────────────────────────────────────
create table if not exists active_rounds (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references golf_courses(id),
  session_id    text not null,               -- client-generated UUID (anon auth)
  current_hole  int  not null default 1,
  player_lat    double precision,
  player_lng    double precision,
  unit          text not null default 'yards' check (unit in ('yards','meters')),
  started_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists idx_active_rounds_session on active_rounds(session_id);

-- ─── Round Hole States ───────────────────────────────────────────────────────
create table if not exists round_hole_states (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references active_rounds(id) on delete cascade,
  hole_number int  not null check (hole_number between 1 and 18),
  score       int,
  putts       int,
  fairway_hit boolean,
  gir         boolean,                       -- green in regulation
  notes       text,
  unique (round_id, hole_number)
);

create index if not exists idx_round_hole_states_round on round_hole_states(round_id);

-- ─── Shots ──────────────────────────────────────────────────────────────────
create table if not exists shots (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references active_rounds(id) on delete cascade,
  hole_number    int  not null,
  shot_number    int  not null default 1,
  start_lat      double precision not null,
  start_lng      double precision not null,
  end_lat        double precision,
  end_lng        double precision,
  distance_yards int,                        -- computed on end-shot
  club_used      text,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz
);

create index if not exists idx_shots_round on shots(round_id);
create index if not exists idx_shots_round_hole on shots(round_id, hole_number);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Course data is publicly readable
alter table golf_courses       enable row level security;
alter table course_holes       enable row level security;
alter table tee_boxes          enable row level security;
alter table greens             enable row level security;
alter table hazards            enable row level security;
alter table active_rounds      enable row level security;
alter table round_hole_states  enable row level security;
alter table shots              enable row level security;

create policy "public_read_courses"   on golf_courses      for select using (true);
create policy "public_read_holes"     on course_holes      for select using (true);
create policy "public_read_tees"      on tee_boxes         for select using (true);
create policy "public_read_greens"    on greens            for select using (true);
create policy "public_read_hazards"   on hazards           for select using (true);

-- Round data keyed on session_id (anon, no Supabase Auth required)
create policy "session_select_rounds" on active_rounds     for select using (true);
create policy "session_insert_rounds" on active_rounds     for insert with check (true);
create policy "session_update_rounds" on active_rounds     for update using (true);

create policy "session_select_states" on round_hole_states for select using (true);
create policy "session_insert_states" on round_hole_states for insert with check (true);
create policy "session_update_states" on round_hole_states for update using (true);

create policy "session_select_shots"  on shots             for select using (true);
create policy "session_insert_shots"  on shots             for insert with check (true);
create policy "session_update_shots"  on shots             for update using (true);
