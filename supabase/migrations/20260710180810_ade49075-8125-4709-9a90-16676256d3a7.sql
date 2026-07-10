
CREATE TABLE IF NOT EXISTS public.gi_search_counter (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  count BIGINT NOT NULL DEFAULT 0,
  last_query TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO public.gi_search_counter (id, count) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.gi_search_counter TO authenticated;
GRANT ALL ON public.gi_search_counter TO service_role;
ALTER TABLE public.gi_search_counter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can read counter" ON public.gi_search_counter FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.gi_probe_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  feature TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  status INTEGER,
  content_type TEXT,
  provider_request_id TEXT,
  verdict TEXT NOT NULL,
  preview TEXT
);
GRANT SELECT ON public.gi_probe_log TO authenticated;
GRANT ALL ON public.gi_probe_log TO service_role;
ALTER TABLE public.gi_probe_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can read probe log" ON public.gi_probe_log FOR SELECT TO authenticated USING (true);
