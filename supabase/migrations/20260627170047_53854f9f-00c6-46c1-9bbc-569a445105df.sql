create or replace function public.get_hole_geometry(
  p_course_id uuid,
  p_hole_number integer
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  v_hole public.golf_holes%rowtype;
  v_result jsonb;
  v_points jsonb;
  v_hazards jsonb;
  v_green jsonb;
  v_fairway jsonb;
  v_daily_pin jsonb;
begin
  select * into v_hole
  from public.golf_holes
  where course_id = p_course_id and hole_number = p_hole_number
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'point_type', point_type,
    'label', label,
    'lat', st_y(location::geometry),
    'lng', st_x(location::geometry),
    'meta', meta
  )), '[]'::jsonb)
  into v_points
  from public.golf_hole_points
  where hole_id = v_hole.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'hazard_type', hazard_type,
    'label', label,
    'geom', st_asgeojson(geom)::jsonb,
    'center_lat', st_y(st_centroid(geom::geometry)),
    'center_lng', st_x(st_centroid(geom::geometry)),
    'carry_yards_from_tee', carry_yards_from_tee
  )), '[]'::jsonb)
  into v_hazards
  from public.golf_hazards
  where hole_id = v_hole.id;

  select jsonb_build_object(
    'polygon', st_asgeojson(polygon)::jsonb,
    'center_lat', st_y(st_centroid(polygon::geometry)),
    'center_lng', st_x(st_centroid(polygon::geometry)),
    'depth_yards', depth_yards,
    'width_yards', width_yards
  )
  into v_green
  from public.golf_green_polygons
  where hole_id = v_hole.id;

  select jsonb_build_object(
    'polygon', st_asgeojson(polygon)::jsonb
  )
  into v_fairway
  from public.golf_fairway_polygons
  where hole_id = v_hole.id;

  select jsonb_build_object(
    'pin_label', pin_label,
    'effective_date', effective_date
  )
  into v_daily_pin
  from public.golf_daily_pins
  where hole_id = v_hole.id
    and effective_date <= current_date
  order by effective_date desc
  limit 1;

  v_result := jsonb_build_object(
    'hole', jsonb_build_object(
      'id', v_hole.id,
      'hole_number', v_hole.hole_number,
      'par', v_hole.par,
      'handicap', v_hole.handicap,
      'length_black', v_hole.length_black,
      'length_gold', v_hole.length_gold,
      'length_blue', v_hole.length_blue,
      'length_white', v_hole.length_white,
      'length_red', v_hole.length_red,
      'notes', v_hole.notes
    ),
    'points', v_points,
    'hazards', v_hazards,
    'green', v_green,
    'fairway', v_fairway,
    'daily_pin', v_daily_pin
  );

  return v_result;
end $$;

grant execute on function public.get_hole_geometry(uuid, integer) to anon, authenticated, service_role;