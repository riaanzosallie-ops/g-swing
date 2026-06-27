
-- =========================================================
-- G-Swing Membership & Ziina payments — foundation
-- =========================================================

-- 1. PLANS catalog ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gswing_membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL UNIQUE,            -- 'free' | 'premium' | 'elite' | 'platform_owner'
  display_name text NOT NULL,
  tagline text,
  tier_rank int NOT NULL DEFAULT 0,          -- higher = more access
  is_paid boolean NOT NULL DEFAULT false,
  is_internal boolean NOT NULL DEFAULT false,-- hidden from signup
  price_monthly_aed numeric(10,2),
  price_yearly_aed numeric(10,2),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  feature_keys text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gswing_membership_plans TO anon, authenticated;
GRANT ALL ON public.gswing_membership_plans TO service_role;
ALTER TABLE public.gswing_membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans: public read"
  ON public.gswing_membership_plans FOR SELECT
  USING (true);

CREATE POLICY "Plans: owners manage"
  ON public.gswing_membership_plans FOR ALL
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'platform_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'platform_owner'));

-- Seed default catalog
INSERT INTO public.gswing_membership_plans
  (plan_code, display_name, tagline, tier_rank, is_paid, is_internal,
   price_monthly_aed, price_yearly_aed, feature_keys, features)
VALUES
  ('free', 'Free', 'Get on the course', 10, false, false, 0, 0,
    ARRAY['gps_basic','scorecard_basic'],
    '["Basic GPS","Personal scorecard","Round history"]'::jsonb),
  ('premium', 'Premium', 'Smarter every round', 50, true, false, 49.00, 490.00,
    ARRAY['gps_basic','gps_caddie','hazard_intelligence','weather_intelligence',
          'ai_caddie','shot_tracking','advanced_stats','scorecard_basic'],
    '["Full GPS Caddie","Hazard intelligence","Weather intelligence","AI Caddie ACE","Shot tracking","Advanced stats"]'::jsonb),
  ('elite', 'Elite', 'Tour-grade experience', 90, true, false, 99.00, 990.00,
    ARRAY['gps_basic','gps_caddie','hazard_intelligence','weather_intelligence',
          'ai_caddie','shot_tracking','advanced_stats','scorecard_basic',
          'tournament_create','broadcast_center','live_tv','awards','results_poster',
          'course_mapper'],
    '["Everything in Premium","Tournament create","Broadcast Center","Live TV","Awards & results poster","Course Mapper"]'::jsonb),
  ('platform_owner', 'Platform Owner', 'Unlimited', 999, false, true, 0, 0,
    ARRAY['*'],
    '["Unlimited lifetime access"]'::jsonb)
ON CONFLICT (plan_code) DO NOTHING;

-- 2. USER MEMBERSHIPS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gswing_user_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.gswing_membership_plans(plan_code),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly','lifetime','none')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','past_due','cancelled','suspended','expired')),
  activated_at timestamptz,
  current_period_end timestamptz,
  last_payment_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gswing_user_memberships TO authenticated;
GRANT ALL ON public.gswing_user_memberships TO service_role;
ALTER TABLE public.gswing_user_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Memberships: self read"
  ON public.gswing_user_memberships FOR SELECT
  USING (auth.uid() = user_id
         OR public.has_role(auth.uid(), 'owner')
         OR public.has_role(auth.uid(), 'platform_owner')
         OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Memberships: self insert free only"
  ON public.gswing_user_memberships FOR INSERT
  WITH CHECK (auth.uid() = user_id AND plan_code = 'free');

CREATE POLICY "Memberships: owner manage"
  ON public.gswing_user_memberships FOR ALL
  USING (public.has_role(auth.uid(), 'owner')
         OR public.has_role(auth.uid(), 'platform_owner')
         OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner')
              OR public.has_role(auth.uid(), 'platform_owner')
              OR public.has_role(auth.uid(), 'admin'));

-- 3. MEMBERSHIP OVERRIDES (owner grants) -----------------------------------
CREATE TABLE IF NOT EXISTS public.gswing_membership_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  override_type text NOT NULL CHECK (override_type IN ('grant','lifetime','suspend','reactivate')),
  plan_code text REFERENCES public.gswing_membership_plans(plan_code),
  reason text,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gswing_overrides_user_active_idx
  ON public.gswing_membership_overrides (user_id, active);
GRANT SELECT ON public.gswing_membership_overrides TO authenticated;
GRANT ALL ON public.gswing_membership_overrides TO service_role;
ALTER TABLE public.gswing_membership_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Overrides: self read"
  ON public.gswing_membership_overrides FOR SELECT
  USING (auth.uid() = user_id
         OR public.has_role(auth.uid(), 'owner')
         OR public.has_role(auth.uid(), 'platform_owner')
         OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Overrides: owner manage"
  ON public.gswing_membership_overrides FOR ALL
  USING (public.has_role(auth.uid(), 'owner')
         OR public.has_role(auth.uid(), 'platform_owner')
         OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner')
              OR public.has_role(auth.uid(), 'platform_owner')
              OR public.has_role(auth.uid(), 'admin'));

-- 4. PAYMENT SESSIONS (Ziina) ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.gswing_payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.gswing_membership_plans(plan_code),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','yearly')),
  amount_aed numeric(10,2) NOT NULL,
  provider text NOT NULL DEFAULT 'ziina',
  provider_session_id text,
  checkout_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','paid','completed','failed','cancelled','expired')),
  status_message text,
  raw_response jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gswing_payment_user_idx
  ON public.gswing_payment_sessions (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.gswing_payment_sessions TO authenticated;
GRANT ALL ON public.gswing_payment_sessions TO service_role;
ALTER TABLE public.gswing_payment_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payments: self read"
  ON public.gswing_payment_sessions FOR SELECT
  USING (auth.uid() = user_id
         OR public.has_role(auth.uid(), 'owner')
         OR public.has_role(auth.uid(), 'platform_owner')
         OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Payments: self insert"
  ON public.gswing_payment_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Payments: owner manage"
  ON public.gswing_payment_sessions FOR ALL
  USING (public.has_role(auth.uid(), 'owner')
         OR public.has_role(auth.uid(), 'platform_owner')
         OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner')
              OR public.has_role(auth.uid(), 'platform_owner')
              OR public.has_role(auth.uid(), 'admin'));

-- 5. MEMBERSHIP AUDIT (append-only) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.gswing_membership_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,                  -- 'signup','payment_started','payment_completed','grant','suspend','reactivate','owner_bootstrap'
  plan_code text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_session_id uuid REFERENCES public.gswing_payment_sessions(id) ON DELETE SET NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gswing_audit_user_idx
  ON public.gswing_membership_audit (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.gswing_membership_audit TO authenticated;
GRANT ALL ON public.gswing_membership_audit TO service_role;
ALTER TABLE public.gswing_membership_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit: self read"
  ON public.gswing_membership_audit FOR SELECT
  USING (auth.uid() = user_id
         OR public.has_role(auth.uid(), 'owner')
         OR public.has_role(auth.uid(), 'platform_owner')
         OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Audit: insert self or owner"
  ON public.gswing_membership_audit FOR INSERT
  WITH CHECK (auth.uid() = user_id
              OR public.has_role(auth.uid(), 'owner')
              OR public.has_role(auth.uid(), 'platform_owner')
              OR public.has_role(auth.uid(), 'admin'));

-- 6. updated_at triggers ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.gswing_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gswing_plans_updated ON public.gswing_membership_plans;
CREATE TRIGGER trg_gswing_plans_updated BEFORE UPDATE ON public.gswing_membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.gswing_set_updated_at();
DROP TRIGGER IF EXISTS trg_gswing_memberships_updated ON public.gswing_user_memberships;
CREATE TRIGGER trg_gswing_memberships_updated BEFORE UPDATE ON public.gswing_user_memberships
  FOR EACH ROW EXECUTE FUNCTION public.gswing_set_updated_at();
DROP TRIGGER IF EXISTS trg_gswing_overrides_updated ON public.gswing_membership_overrides;
CREATE TRIGGER trg_gswing_overrides_updated BEFORE UPDATE ON public.gswing_membership_overrides
  FOR EACH ROW EXECUTE FUNCTION public.gswing_set_updated_at();
DROP TRIGGER IF EXISTS trg_gswing_payments_updated ON public.gswing_payment_sessions;
CREATE TRIGGER trg_gswing_payments_updated BEFORE UPDATE ON public.gswing_payment_sessions
  FOR EACH ROW EXECUTE FUNCTION public.gswing_set_updated_at();

-- 7. Effective membership RPC ---------------------------------------------
-- Returns the effective plan after applying:
--   - active suspensions (forces 'free' + status='suspended')
--   - lifetime/grant overrides (highest tier_rank wins)
--   - the user's user_memberships row (default fallback)
--   - if no row exists, returns 'free' with status='pending'
CREATE OR REPLACE FUNCTION public.get_effective_gswing_membership(_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  plan_code text,
  status text,
  billing_cycle text,
  source text,                    -- 'override' | 'membership' | 'default'
  current_period_end timestamptz,
  is_owner boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner boolean;
  v_suspend record;
  v_override record;
  v_membership record;
BEGIN
  v_owner := public.has_role(_user_id, 'owner') OR public.has_role(_user_id, 'platform_owner');

  -- Active suspension wins everything except owner.
  SELECT * INTO v_suspend
  FROM public.gswing_membership_overrides
  WHERE gswing_membership_overrides.user_id = _user_id
    AND override_type = 'suspend'
    AND active = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC LIMIT 1;

  IF v_suspend.id IS NOT NULL AND NOT v_owner THEN
    RETURN QUERY SELECT _user_id, 'free'::text, 'suspended'::text, 'none'::text,
                        'override'::text, NULL::timestamptz, false;
    RETURN;
  END IF;

  -- Highest active grant/lifetime override wins.
  SELECT o.*, p.tier_rank INTO v_override
  FROM public.gswing_membership_overrides o
  JOIN public.gswing_membership_plans p ON p.plan_code = o.plan_code
  WHERE o.user_id = _user_id
    AND o.override_type IN ('grant','lifetime')
    AND o.active = true
    AND o.starts_at <= now()
    AND (o.expires_at IS NULL OR o.expires_at > now())
  ORDER BY p.tier_rank DESC, o.created_at DESC
  LIMIT 1;

  IF v_owner THEN
    RETURN QUERY SELECT _user_id, 'platform_owner'::text, 'active'::text,
                        'lifetime'::text, 'override'::text, NULL::timestamptz, true;
    RETURN;
  END IF;

  IF v_override.id IS NOT NULL THEN
    RETURN QUERY SELECT _user_id, v_override.plan_code, 'active'::text,
                        CASE WHEN v_override.override_type = 'lifetime' THEN 'lifetime' ELSE 'monthly' END,
                        'override'::text, v_override.expires_at, false;
    RETURN;
  END IF;

  SELECT * INTO v_membership
  FROM public.gswing_user_memberships
  WHERE gswing_user_memberships.user_id = _user_id;

  IF v_membership.id IS NULL THEN
    RETURN QUERY SELECT _user_id, 'free'::text, 'pending'::text, 'none'::text,
                        'default'::text, NULL::timestamptz, false;
    RETURN;
  END IF;

  -- Expire stale paid memberships down to free.
  IF v_membership.plan_code IN ('premium','elite')
     AND v_membership.current_period_end IS NOT NULL
     AND v_membership.current_period_end < now() THEN
    RETURN QUERY SELECT _user_id, 'free'::text, 'expired'::text, 'none'::text,
                        'membership'::text, v_membership.current_period_end, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT _user_id, v_membership.plan_code, v_membership.status,
                      v_membership.billing_cycle, 'membership'::text,
                      v_membership.current_period_end, false;
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_gswing_membership(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_gswing_membership(uuid) TO authenticated, service_role;

-- 8. New-user bootstrap trigger -------------------------------------------
-- Creates Free membership for every new auth user, and auto-promotes the
-- configured owner email to platform_owner with a lifetime Elite override.
CREATE OR REPLACE FUNCTION public.gswing_bootstrap_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_email text := 'riaanzosallie@gmail.com';
BEGIN
  -- Free membership default (does nothing if already present).
  INSERT INTO public.gswing_user_memberships (user_id, plan_code, billing_cycle, status, activated_at)
  VALUES (NEW.id, 'free', 'none', 'active', now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.gswing_membership_audit (user_id, event_type, plan_code, details)
  VALUES (NEW.id, 'signup', 'free', jsonb_build_object('email', NEW.email));

  IF lower(NEW.email) = lower(v_owner_email) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'platform_owner')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.gswing_membership_overrides
      (user_id, override_type, plan_code, reason, granted_by, active)
    VALUES (NEW.id, 'lifetime', 'elite', 'Owner / Creator lifetime', NEW.id, true);

    INSERT INTO public.gswing_membership_audit (user_id, event_type, plan_code, details)
    VALUES (NEW.id, 'owner_bootstrap', 'elite', jsonb_build_object('email', NEW.email));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gswing_bootstrap_new_user ON auth.users;
CREATE TRIGGER trg_gswing_bootstrap_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.gswing_bootstrap_new_user();

-- 9. Backfill: ensure existing users have a Free membership ---------------
INSERT INTO public.gswing_user_memberships (user_id, plan_code, billing_cycle, status, activated_at)
SELECT u.id, 'free', 'none', 'active', now()
FROM auth.users u
LEFT JOIN public.gswing_user_memberships m ON m.user_id = u.id
WHERE m.id IS NULL;

-- 10. Owner email backfill -------------------------------------------------
DO $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE lower(email) = 'riaanzosallie@gmail.com' LIMIT 1;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_owner, 'platform_owner')
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.gswing_membership_overrides
      (user_id, override_type, plan_code, reason, granted_by, active)
    SELECT v_owner, 'lifetime', 'elite', 'Owner / Creator lifetime backfill', v_owner, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.gswing_membership_overrides
      WHERE user_id = v_owner AND override_type = 'lifetime' AND plan_code = 'elite' AND active = true
    );
  END IF;
END $$;
