-- Seed Sharjah Golf and Shooting Club into the G-Swing course mapping tables.
-- Anchor point + verified front-9 par layout only. Geometry stays NULL until
-- mapped by an admin. Idempotent via fixed UUID.

INSERT INTO public.gswing_course_maps (id, course_name, location_label, latitude, longitude)
VALUES (
  '00000000-0000-0000-0000-00000005ada1'::uuid,
  'Sharjah Golf and Shooting Club',
  'Sharjah, UAE',
  25.3536,
  55.4881
)
ON CONFLICT (id) DO UPDATE SET
  course_name    = EXCLUDED.course_name,
  location_label = EXCLUDED.location_label,
  latitude       = EXCLUDED.latitude,
  longitude      = EXCLUDED.longitude;

INSERT INTO public.gswing_mapped_holes (course_map_id, hole_number, par)
VALUES
  ('00000000-0000-0000-0000-00000005ada1'::uuid, 1, 4),
  ('00000000-0000-0000-0000-00000005ada1'::uuid, 2, 4),
  ('00000000-0000-0000-0000-00000005ada1'::uuid, 3, 3),
  ('00000000-0000-0000-0000-00000005ada1'::uuid, 4, 5),
  ('00000000-0000-0000-0000-00000005ada1'::uuid, 5, 4),
  ('00000000-0000-0000-0000-00000005ada1'::uuid, 6, 5),
  ('00000000-0000-0000-0000-00000005ada1'::uuid, 7, 4),
  ('00000000-0000-0000-0000-00000005ada1'::uuid, 8, 3),
  ('00000000-0000-0000-0000-00000005ada1'::uuid, 9, 4)
ON CONFLICT (course_map_id, hole_number) DO UPDATE SET par = EXCLUDED.par;