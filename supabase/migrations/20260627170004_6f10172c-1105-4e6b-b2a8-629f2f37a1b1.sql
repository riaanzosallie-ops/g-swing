create extension if not exists postgis;

-- =========================================================
-- COURSES
-- =========================================================
create table public.golf_courses (
  id uuid primary key default gen_random_uuid(),
  external_ref text unique,
  name text not null,
  club text,
  city text,
  country text,
  latitude double precision,
  longitude double precision,
  location geography(Point,4326),
  total_holes integer not null default 18,
  par integer,
  timezone text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index golf_courses_location_gix on public.golf_courses using gist(location);
create index golf_courses_country_idx on public.golf_courses(country);

-- =========================================================
-- HOLES
-- =========================================================
create table public.golf_holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.golf_courses(id) on delete cascade,
  hole_number integer not null,
  par integer,
  handicap integer,
  length_black integer,
  length_gold integer,
  length_blue integer,
  length_white integer,
  length_red integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, hole_number)
);
create index golf_holes_course_idx on public.golf_holes(course_id);

-- =========================================================
-- HOLE REFERENCE POINTS (tees, fairway start, layups, green ref pts, pins, dogleg)
-- =========================================================
create type public.golf_point_type as enum (
  'tee_back','tee_middle','tee_front',
  'fairway_start','layup',
  'green_front','green_center','green_back',
  'pin_position','dogleg'
);

create table public.golf_hole_points (
  id uuid primary key default gen_random_uuid(),
  hole_id uuid not null references public.golf_holes(id) on delete cascade,
  point_type public.golf_point_type not null,
  label text,
  location geography(Point,4326) not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index golf_hole_points_hole_idx on public.golf_hole_points(hole_id);
create index golf_hole_points_type_idx on public.golf_hole_points(point_type);
create index golf_hole_points_location_gix on public.golf_hole_points using gist(location);

-- =========================================================
-- HAZARDS
-- =========================================================
create type public.golf_hazard_type as enum (
  'bunker','water','trees','waste','ob','cart_path','creek','other'
);

create table public.golf_hazards (
  id uuid primary key default gen_random_uuid(),
  hole_id uuid not null references public.golf_holes(id) on delete cascade,
  hazard_type public.golf_hazard_type not null,
  label text,
  geom geography(Geometry,4326) not null,
  carry_yards_from_tee integer,
  created_at timestamptz not null default now()
);
create index golf_hazards_hole_idx on public.golf_hazards(hole_id);
create index golf_hazards_geom_gix on public.golf_hazards using gist(geom);

-- =========================================================
-- GREEN POLYGON
-- =========================================================
create table public.golf_green_polygons (
  id uuid primary key default gen_random_uuid(),
  hole_id uuid not null references public.golf_holes(id) on delete cascade unique,
  polygon geography(Polygon,4326) not null,
  depth_yards integer,
  width_yards integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index golf_green_polygons_gix on public.golf_green_polygons using gist(polygon);

-- =========================================================
-- FAIRWAY POLYGON
-- =========================================================
create table public.golf_fairway_polygons (
  id uuid primary key default gen_random_uuid(),
  hole_id uuid not null references public.golf_holes(id) on delete cascade unique,
  polygon geography(Polygon,4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index golf_fairway_polygons_gix on public.golf_fairway_polygons using gist(polygon);

-- =========================================================
-- DAILY PIN SELECTION (A/B/C/D etc.)
-- =========================================================
create table public.golf_daily_pins (
  id uuid primary key default gen_random_uuid(),
  hole_id uuid not null references public.golf_holes(id) on delete cascade,
  pin_label text not null,
  effective_date date not null default current_date,
  set_by uuid,
  created_at timestamptz not null default now(),
  unique(hole_id, effective_date)
);
create index golf_daily_pins_hole_date_idx on public.golf_daily_pins(hole_id, effective_date desc);

-- =========================================================
-- SHOT TRACKING (new; existing scoring/round tables are not modified)
-- =========================================================
create table public.golf_shots (
  id uuid primary key default gen_random_uuid(),
  round_id text,
  user_id uuid,
  course_id uuid references public.golf_courses(id) on delete set null,
  hole_id uuid references public.golf_holes(id) on delete set null,
  hole_number integer,
  shot_number integer,
  club text,
  start_location geography(Point,4326),
  end_location geography(Point,4326),
  distance_yards numeric(6,1),
  lie text,
  elevation_change_ft numeric(6,1),
  wind_speed_mph numeric(5,1),
  wind_direction_deg numeric(5,1),
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index golf_shots_round_idx on public.golf_shots(round_id);
create index golf_shots_user_idx on public.golf_shots(user_id);
create index golf_shots_hole_idx on public.golf_shots(hole_id);

-- =========================================================
-- updated_at trigger
-- =========================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger golf_courses_updated_at before update on public.golf_courses
  for each row execute function public.set_updated_at();
create trigger golf_holes_updated_at before update on public.golf_holes
  for each row execute function public.set_updated_at();
create trigger golf_green_polygons_updated_at before update on public.golf_green_polygons
  for each row execute function public.set_updated_at();
create trigger golf_fairway_polygons_updated_at before update on public.golf_fairway_polygons
  for each row execute function public.set_updated_at();

-- =========================================================
-- GRANTS (reference data: public read; writes via service_role)
-- =========================================================
grant select on public.golf_courses          to anon, authenticated;
grant select on public.golf_holes            to anon, authenticated;
grant select on public.golf_hole_points      to anon, authenticated;
grant select on public.golf_hazards          to anon, authenticated;
grant select on public.golf_green_polygons   to anon, authenticated;
grant select on public.golf_fairway_polygons to anon, authenticated;
grant select on public.golf_daily_pins       to anon, authenticated;

grant all on public.golf_courses          to service_role;
grant all on public.golf_holes            to service_role;
grant all on public.golf_hole_points      to service_role;
grant all on public.golf_hazards          to service_role;
grant all on public.golf_green_polygons   to service_role;
grant all on public.golf_fairway_polygons to service_role;
grant all on public.golf_daily_pins       to service_role;

grant select, insert, update, delete on public.golf_shots to authenticated;
grant all on public.golf_shots to service_role;

-- =========================================================
-- RLS
-- =========================================================
alter table public.golf_courses          enable row level security;
alter table public.golf_holes            enable row level security;
alter table public.golf_hole_points      enable row level security;
alter table public.golf_hazards          enable row level security;
alter table public.golf_green_polygons   enable row level security;
alter table public.golf_fairway_polygons enable row level security;
alter table public.golf_daily_pins       enable row level security;
alter table public.golf_shots            enable row level security;

create policy "courses readable"      on public.golf_courses          for select using (true);
create policy "holes readable"        on public.golf_holes            for select using (true);
create policy "hole points readable"  on public.golf_hole_points      for select using (true);
create policy "hazards readable"      on public.golf_hazards          for select using (true);
create policy "greens readable"       on public.golf_green_polygons   for select using (true);
create policy "fairways readable"     on public.golf_fairway_polygons for select using (true);
create policy "pins readable"         on public.golf_daily_pins       for select using (true);

create policy "own shots readable" on public.golf_shots
  for select using (user_id is null or auth.uid() = user_id);
create policy "insert own shots" on public.golf_shots
  for insert with check (user_id is null or auth.uid() = user_id);
create policy "update own shots" on public.golf_shots
  for update using (auth.uid() = user_id);
create policy "delete own shots" on public.golf_shots
  for delete using (auth.uid() = user_id);