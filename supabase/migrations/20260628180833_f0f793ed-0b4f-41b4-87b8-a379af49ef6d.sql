
DROP POLICY IF EXISTS "delete own shots" ON public.golf_shots;
DROP POLICY IF EXISTS "update own shots" ON public.golf_shots;
CREATE POLICY "delete own shots" ON public.golf_shots FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "update own shots" ON public.golf_shots FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated can join as themselves" ON public.tournament_players;
CREATE POLICY "Authenticated can join as themselves" ON public.tournament_players
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IS NOT NULL AND (
      auth.uid() = user_id
      OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_players.tournament_id AND t.director_id = auth.uid())
    )
  );
