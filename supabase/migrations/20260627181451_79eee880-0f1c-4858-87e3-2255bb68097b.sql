insert into public.golf_courses (id, name, city, country, latitude, longitude, total_holes, par, timezone) values
  ('00000000-0000-0000-0000-000000000101','Sharjah Golf and Shooting Club','Sharjah','AE',25.3536,55.4881,9,36,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000001','Emirates Golf Club - Majlis','Dubai','AE',25.0911,55.1572,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000102','Emirates Golf Club - Faldo','Dubai','AE',25.0915,55.1585,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000103','Dubai Creek Golf and Yacht Club','Dubai','AE',25.2420,55.3330,18,71,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000104','Jumeirah Golf Estates - Earth','Dubai','AE',25.0259,55.1856,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000105','Jumeirah Golf Estates - Fire','Dubai','AE',25.0268,55.1840,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000106','Trump International Golf Club Dubai','Dubai','AE',25.0353,55.2272,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000107','Dubai Hills Golf Club','Dubai','AE',25.1176,55.2535,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000108','The Els Club Dubai','Dubai','AE',25.0344,55.2207,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000109','Arabian Ranches Golf Club','Dubai','AE',25.0533,55.2708,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000110','The Montgomerie Golf Club Dubai','Dubai','AE',25.0709,55.1514,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000111','JA The Resort Golf Course','Dubai','AE',24.9884,55.0270,9,36,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000112','The Track Meydan Golf','Dubai','AE',25.1586,55.3004,9,36,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000113','Yas Links Abu Dhabi','Abu Dhabi','AE',24.4673,54.6010,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000114','Saadiyat Beach Golf Club','Abu Dhabi','AE',24.5547,54.4282,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000115','Abu Dhabi Golf Club','Abu Dhabi','AE',24.4277,54.5682,27,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000116','Abu Dhabi City Golf Club','Abu Dhabi','AE',24.4399,54.3863,9,35,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000117','Al Ghazal Golf Club','Abu Dhabi','AE',24.4287,54.6451,18,71,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000118','Al Ain Equestrian Shooting and Golf Club','Al Ain','AE',24.1844,55.7608,18,71,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000119','Al Dhannah Golf Club','Al Dhannah','AE',24.1928,52.6267,9,36,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000120','Al Zorah Golf Club','Ajman','AE',25.4149,55.4689,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000121','Al Hamra Golf Club','Ras Al Khaimah','AE',25.6842,55.7792,18,72,'Asia/Dubai'),
  ('00000000-0000-0000-0000-000000000122','Tower Links Golf Club','Ras Al Khaimah','AE',25.7776,55.9650,18,72,'Asia/Dubai')
on conflict (id) do update set
  name = excluded.name, city = excluded.city, country = excluded.country,
  latitude = excluded.latitude, longitude = excluded.longitude,
  total_holes = excluded.total_holes, par = excluded.par, timezone = excluded.timezone;

insert into public.golf_holes (course_id, hole_number, par, length_white)
select '00000000-0000-0000-0000-000000000101', gs, 4, 380
from generate_series(1, 9) as gs
on conflict (course_id, hole_number) do nothing;