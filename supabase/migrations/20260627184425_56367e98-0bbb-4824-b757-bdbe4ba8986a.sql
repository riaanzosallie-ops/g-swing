
DROP POLICY IF EXISTS "own shots readable" ON public.golf_shots;
DROP POLICY IF EXISTS "insert own shots" ON public.golf_shots;
CREATE POLICY "own shots readable" ON public.golf_shots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own shots" ON public.golf_shots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Director can update own tournament" ON public.tournaments;
DROP POLICY IF EXISTS "Director can delete own tournament" ON public.tournaments;
CREATE POLICY "Authenticated can create tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (auth.uid() = director_id);
CREATE POLICY "Director can update own tournament" ON public.tournaments FOR UPDATE TO authenticated USING (auth.uid() = director_id) WITH CHECK (auth.uid() = director_id);
CREATE POLICY "Director can delete own tournament" ON public.tournaments FOR DELETE TO authenticated USING (auth.uid() = director_id);

DROP POLICY IF EXISTS "Anyone can join tournament" ON public.tournament_players;
DROP POLICY IF EXISTS "Anyone can update tournament player" ON public.tournament_players;
DROP POLICY IF EXISTS "Anyone can delete tournament player" ON public.tournament_players;
CREATE POLICY "Authenticated can join as themselves" ON public.tournament_players FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.director_id = auth.uid()));
CREATE POLICY "Owner or director update player" ON public.tournament_players FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.director_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.director_id = auth.uid()));
CREATE POLICY "Owner or director delete player" ON public.tournament_players FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.director_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can submit scores" ON public.tournament_scores;
DROP POLICY IF EXISTS "Anyone can update scores" ON public.tournament_scores;
DROP POLICY IF EXISTS "Anyone can delete scores" ON public.tournament_scores;
CREATE POLICY "Owner or director submit score" ON public.tournament_scores FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tournament_players p WHERE p.id = player_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.director_id = auth.uid()));
CREATE POLICY "Owner or director update score" ON public.tournament_scores FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tournament_players p WHERE p.id = player_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.director_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tournament_players p WHERE p.id = player_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.director_id = auth.uid()));
CREATE POLICY "Owner or director delete score" ON public.tournament_scores FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tournament_players p WHERE p.id = player_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.director_id = auth.uid()));

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text) FROM anon, authenticated, PUBLIC;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text) FROM anon, authenticated, PUBLIC;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM anon, authenticated, PUBLIC;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
