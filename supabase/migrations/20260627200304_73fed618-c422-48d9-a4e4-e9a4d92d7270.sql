
-- 1. Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner','platform_owner','admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_gswing_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner','platform_owner','admin')
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_gswing_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_gswing_admin(UUID) TO authenticated, service_role;

-- 4. user_roles policies
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gswing_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_gswing_admin(auth.uid()))
  WITH CHECK (public.is_gswing_admin(auth.uid()));

-- 5. Grant DML on gswing_* mapping tables to authenticated (RLS still gates)
GRANT INSERT, UPDATE, DELETE ON public.gswing_course_maps TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gswing_mapped_holes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gswing_hole_features TO authenticated;

-- 6. Admin-only write policies (additive — existing public SELECT policies remain)
DROP POLICY IF EXISTS "Admins insert course maps" ON public.gswing_course_maps;
CREATE POLICY "Admins insert course maps"
  ON public.gswing_course_maps FOR INSERT TO authenticated
  WITH CHECK (public.is_gswing_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update course maps" ON public.gswing_course_maps;
CREATE POLICY "Admins update course maps"
  ON public.gswing_course_maps FOR UPDATE TO authenticated
  USING (public.is_gswing_admin(auth.uid()))
  WITH CHECK (public.is_gswing_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete course maps" ON public.gswing_course_maps;
CREATE POLICY "Admins delete course maps"
  ON public.gswing_course_maps FOR DELETE TO authenticated
  USING (public.is_gswing_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins insert mapped holes" ON public.gswing_mapped_holes;
CREATE POLICY "Admins insert mapped holes"
  ON public.gswing_mapped_holes FOR INSERT TO authenticated
  WITH CHECK (public.is_gswing_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update mapped holes" ON public.gswing_mapped_holes;
CREATE POLICY "Admins update mapped holes"
  ON public.gswing_mapped_holes FOR UPDATE TO authenticated
  USING (public.is_gswing_admin(auth.uid()))
  WITH CHECK (public.is_gswing_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete mapped holes" ON public.gswing_mapped_holes;
CREATE POLICY "Admins delete mapped holes"
  ON public.gswing_mapped_holes FOR DELETE TO authenticated
  USING (public.is_gswing_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins insert hole features" ON public.gswing_hole_features;
CREATE POLICY "Admins insert hole features"
  ON public.gswing_hole_features FOR INSERT TO authenticated
  WITH CHECK (public.is_gswing_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update hole features" ON public.gswing_hole_features;
CREATE POLICY "Admins update hole features"
  ON public.gswing_hole_features FOR UPDATE TO authenticated
  USING (public.is_gswing_admin(auth.uid()))
  WITH CHECK (public.is_gswing_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete hole features" ON public.gswing_hole_features;
CREATE POLICY "Admins delete hole features"
  ON public.gswing_hole_features FOR DELETE TO authenticated
  USING (public.is_gswing_admin(auth.uid()));
