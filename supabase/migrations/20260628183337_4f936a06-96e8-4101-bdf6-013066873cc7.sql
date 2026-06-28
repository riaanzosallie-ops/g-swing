ALTER TABLE public.gswing_hole_features
  DROP CONSTRAINT IF EXISTS gswing_hole_features_feature_type_check;

ALTER TABLE public.gswing_hole_features
  ADD CONSTRAINT gswing_hole_features_feature_type_check
  CHECK (feature_type IN (
    'tee',
    'green_front',
    'green_center',
    'green_back',
    'pin',
    'bunker',
    'water',
    'penalty',
    'ob',
    'trees',
    'rough',
    'waste',
    'layup',
    'dogleg',
    'landing_zone',
    'fairway_polygon',
    'green_polygon',
    'tee_polygon',
    'hole_boundary',
    'rough_polygon',
    'cart_path',
    'na_marker'
  ));