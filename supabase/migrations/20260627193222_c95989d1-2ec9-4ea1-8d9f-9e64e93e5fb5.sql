ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS course_latitude double precision,
  ADD COLUMN IF NOT EXISTS course_longitude double precision,
  ADD COLUMN IF NOT EXISTS course_location_label text;