
CREATE OR REPLACE FUNCTION public.gi_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.gi_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gi_course_id text NOT NULL UNIQUE,
  name text NOT NULL,
  city text,
  state text,
  country text,
  latitude double precision,
  longitude double precision,
  detail jsonb,
  scorecard jsonb,
  gps jsonb,
  detail_fetched_at timestamptz,
  scorecard_fetched_at timestamptz,
  gps_fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gi_courses TO authenticated;
GRANT ALL ON public.gi_courses TO service_role;
ALTER TABLE public.gi_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read gi_courses"
ON public.gi_courses FOR SELECT TO authenticated USING (true);
CREATE TRIGGER gi_courses_set_updated_at
BEFORE UPDATE ON public.gi_courses
FOR EACH ROW EXECUTE FUNCTION public.gi_set_updated_at();

CREATE TABLE public.gi_hole_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gi_course_id text NOT NULL REFERENCES public.gi_courses(gi_course_id) ON DELETE CASCADE,
  hole_number int NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('green_slope','elevation')),
  storage_path text,
  payload jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gi_course_id, hole_number, asset_type)
);
GRANT SELECT ON public.gi_hole_assets TO authenticated;
GRANT ALL ON public.gi_hole_assets TO service_role;
ALTER TABLE public.gi_hole_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read gi_hole_assets"
ON public.gi_hole_assets FOR SELECT TO authenticated USING (true);

CREATE TABLE public.gi_credit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  gi_course_id text,
  hole_number int,
  credits_estimated numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.gi_credit_log TO service_role;
ALTER TABLE public.gi_credit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS gi_course_id text;
