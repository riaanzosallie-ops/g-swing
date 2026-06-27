-- G-Swing Premium Course Mapping Engine — additive, public-read course geometry.
-- Existing PostGIS-backed golf_* tables are untouched. These gswing_* tables are
-- a denormalised, app-facing layer that the Mapping Engine reads and writes.

CREATE TABLE IF NOT EXISTS public.gswing_course_maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_name TEXT NOT NULL,
  location_label TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gswing_course_maps TO anon, authenticated;
GRANT ALL ON public.gswing_course_maps TO service_role;
ALTER TABLE public.gswing_course_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Course maps are publicly readable"
  ON public.gswing_course_maps FOR SELECT
  USING (true);
-- Writes: service_role only (no policy → blocked for anon/authenticated).

CREATE TABLE IF NOT EXISTS public.gswing_mapped_holes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_map_id UUID NOT NULL REFERENCES public.gswing_course_maps(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 27),
  par INTEGER,
  length_yards INTEGER,
  length_meters INTEGER,
  tee_lat DOUBLE PRECISION,
  tee_lng DOUBLE PRECISION,
  green_front_lat DOUBLE PRECISION,
  green_front_lng DOUBLE PRECISION,
  green_center_lat DOUBLE PRECISION,
  green_center_lng DOUBLE PRECISION,
  green_back_lat DOUBLE PRECISION,
  green_back_lng DOUBLE PRECISION,
  pin_lat DOUBLE PRECISION,
  pin_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_map_id, hole_number)
);
GRANT SELECT ON public.gswing_mapped_holes TO anon, authenticated;
GRANT ALL ON public.gswing_mapped_holes TO service_role;
ALTER TABLE public.gswing_mapped_holes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mapped holes are publicly readable"
  ON public.gswing_mapped_holes FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.gswing_hole_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mapped_hole_id UUID NOT NULL REFERENCES public.gswing_mapped_holes(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL CHECK (feature_type IN (
    'bunker','water','penalty_area','out_of_bounds',
    'layup','dogleg','landing_zone','trees','rough','waste_area','custom'
  )),
  name TEXT,
  side_label TEXT CHECK (side_label IN ('left','right','center','short','long')),
  front_lat DOUBLE PRECISION,
  front_lng DOUBLE PRECISION,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  carry_lat DOUBLE PRECISION,
  carry_lng DOUBLE PRECISION,
  polygon_json JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gswing_hole_features TO anon, authenticated;
GRANT ALL ON public.gswing_hole_features TO service_role;
ALTER TABLE public.gswing_hole_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hole features are publicly readable"
  ON public.gswing_hole_features FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS gswing_mapped_holes_course_idx
  ON public.gswing_mapped_holes (course_map_id, hole_number);
CREATE INDEX IF NOT EXISTS gswing_hole_features_hole_idx
  ON public.gswing_hole_features (mapped_hole_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.gswing_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS gswing_course_maps_touch ON public.gswing_course_maps;
CREATE TRIGGER gswing_course_maps_touch BEFORE UPDATE ON public.gswing_course_maps
  FOR EACH ROW EXECUTE FUNCTION public.gswing_touch_updated_at();

DROP TRIGGER IF EXISTS gswing_mapped_holes_touch ON public.gswing_mapped_holes;
CREATE TRIGGER gswing_mapped_holes_touch BEFORE UPDATE ON public.gswing_mapped_holes
  FOR EACH ROW EXECUTE FUNCTION public.gswing_touch_updated_at();

DROP TRIGGER IF EXISTS gswing_hole_features_touch ON public.gswing_hole_features;
CREATE TRIGGER gswing_hole_features_touch BEFORE UPDATE ON public.gswing_hole_features
  FOR EACH ROW EXECUTE FUNCTION public.gswing_touch_updated_at();
