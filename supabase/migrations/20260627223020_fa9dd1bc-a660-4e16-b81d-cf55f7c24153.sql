
ALTER TABLE public.gswing_course_maps
  ADD COLUMN IF NOT EXISTS external_provider TEXT,
  ADD COLUMN IF NOT EXISTS external_course_id TEXT,
  ADD COLUMN IF NOT EXISTS last_synced TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_version INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.course_sync_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_map_id UUID REFERENCES public.gswing_course_maps(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_course_id TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  accepted JSONB NOT NULL DEFAULT '[]'::jsonb,
  rejected JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_id UUID,
  notes TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_sync_history TO authenticated;
GRANT ALL ON public.course_sync_history TO service_role;

ALTER TABLE public.course_sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sync history"
  ON public.course_sync_history FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner','platform_owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner','platform_owner','admin')
    )
  );

CREATE INDEX IF NOT EXISTS course_sync_history_map_idx
  ON public.course_sync_history(course_map_id, synced_at DESC);
