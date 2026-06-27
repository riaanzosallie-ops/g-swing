
-- Tournaments
CREATE TABLE public.tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  course TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'Stroke', -- Stroke | Stableford | MatchPlay
  scoring TEXT NOT NULL DEFAULT 'Gross', -- Gross | Net | Both
  holes INT NOT NULL DEFAULT 18,
  par INT NOT NULL DEFAULT 72,
  status TEXT NOT NULL DEFAULT 'Open', -- Open | Live | Closed
  director_id UUID,
  starts_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournaments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournaments are public read" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Anyone can create tournaments" ON public.tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Director can update own tournament" ON public.tournaments FOR UPDATE USING (director_id IS NULL OR director_id = auth.uid());
CREATE POLICY "Director can delete own tournament" ON public.tournaments FOR DELETE USING (director_id IS NULL OR director_id = auth.uid());

-- Players
CREATE TABLE public.tournament_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  handicap NUMERIC NOT NULL DEFAULT 0,
  flight TEXT,
  tee_time TIMESTAMPTZ,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournament_players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_players TO authenticated;
GRANT ALL ON public.tournament_players TO service_role;
ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournament players public read" ON public.tournament_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join tournament" ON public.tournament_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tournament player" ON public.tournament_players FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete tournament player" ON public.tournament_players FOR DELETE USING (true);

-- Scores
CREATE TABLE public.tournament_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.tournament_players(id) ON DELETE CASCADE,
  hole INT NOT NULL,
  par INT NOT NULL DEFAULT 4,
  strokes INT NOT NULL,
  putts INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, hole)
);
GRANT SELECT ON public.tournament_scores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_scores TO authenticated;
GRANT ALL ON public.tournament_scores TO service_role;
ALTER TABLE public.tournament_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournament scores public read" ON public.tournament_scores FOR SELECT USING (true);
CREATE POLICY "Anyone can submit scores" ON public.tournament_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update scores" ON public.tournament_scores FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete scores" ON public.tournament_scores FOR DELETE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_scores;

ALTER TABLE public.tournaments REPLICA IDENTITY FULL;
ALTER TABLE public.tournament_players REPLICA IDENTITY FULL;
ALTER TABLE public.tournament_scores REPLICA IDENTITY FULL;
