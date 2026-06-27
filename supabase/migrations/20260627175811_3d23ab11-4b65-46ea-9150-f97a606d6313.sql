ALTER TABLE public.golf_shots
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS golf_shots_metadata_idx ON public.golf_shots USING gin (metadata);