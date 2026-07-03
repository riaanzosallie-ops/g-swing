
-- === Wipe legacy course cache & geometry =====================================
TRUNCATE TABLE public.gswing_hole_features RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.gswing_mapped_holes RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.gswing_course_maps RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.golf_hazards RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.golf_green_polygons RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.golf_fairway_polygons RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.golf_hole_points RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.golf_daily_pins RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.golf_holes RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.golf_courses RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.course_sync_history RESTART IDENTITY CASCADE;

-- === golfapi_clubs ============================================================
CREATE TABLE public.golfapi_clubs (
  club_id TEXT PRIMARY KEY,
  club_name TEXT NOT NULL,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  country2 TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  website TEXT,
  telephone TEXT,
  timestamp_updated BIGINT,
  raw JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.golfapi_clubs TO authenticated;
GRANT ALL ON public.golfapi_clubs TO service_role;
ALTER TABLE public.golfapi_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read clubs" ON public.golfapi_clubs FOR SELECT TO authenticated USING (true);

-- === golfapi_courses ==========================================================
CREATE TABLE public.golfapi_courses (
  course_id TEXT PRIMARY KEY,
  club_id TEXT REFERENCES public.golfapi_clubs(club_id) ON DELETE SET NULL,
  course_name TEXT NOT NULL,
  num_holes SMALLINT NOT NULL DEFAULT 18,
  has_gps BOOLEAN NOT NULL DEFAULT false,
  measure TEXT,
  pars_men SMALLINT[],
  indexes_men SMALLINT[],
  pars_women SMALLINT[],
  indexes_women SMALLINT[],
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timestamp_updated BIGINT,
  raw JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.golfapi_courses TO authenticated;
GRANT ALL ON public.golfapi_courses TO service_role;
ALTER TABLE public.golfapi_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read courses" ON public.golfapi_courses FOR SELECT TO authenticated USING (true);
CREATE INDEX golfapi_courses_club_idx ON public.golfapi_courses(club_id);

-- === golfapi_tees =============================================================
CREATE TABLE public.golfapi_tees (
  tee_id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.golfapi_courses(course_id) ON DELETE CASCADE,
  tee_name TEXT,
  tee_color TEXT,
  lengths INTEGER[],
  course_rating_men NUMERIC,
  slope_men INTEGER,
  course_rating_women NUMERIC,
  slope_women INTEGER,
  raw JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.golfapi_tees TO authenticated;
GRANT ALL ON public.golfapi_tees TO service_role;
ALTER TABLE public.golfapi_tees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read tees" ON public.golfapi_tees FOR SELECT TO authenticated USING (true);
CREATE INDEX golfapi_tees_course_idx ON public.golfapi_tees(course_id);

-- === golfapi_coordinates ======================================================
CREATE TABLE public.golfapi_coordinates (
  id BIGSERIAL PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.golfapi_courses(course_id) ON DELETE CASCADE,
  hole SMALLINT NOT NULL,
  poi SMALLINT NOT NULL,
  location SMALLINT,
  side_fw SMALLINT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.golfapi_coordinates TO authenticated;
GRANT ALL ON public.golfapi_coordinates TO service_role;
ALTER TABLE public.golfapi_coordinates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read coordinates" ON public.golfapi_coordinates FOR SELECT TO authenticated USING (true);
CREATE INDEX golfapi_coordinates_course_hole_idx ON public.golfapi_coordinates(course_id, hole);

-- === golf_api_logs ============================================================
CREATE TABLE public.golf_api_logs (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  params JSONB,
  status INTEGER,
  latency_ms INTEGER,
  api_requests_left TEXT,
  error TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.golf_api_logs TO authenticated;
GRANT ALL ON public.golf_api_logs TO service_role;
ALTER TABLE public.golf_api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read logs" ON public.golf_api_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX golf_api_logs_created_idx ON public.golf_api_logs(created_at DESC);
