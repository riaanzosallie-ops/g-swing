import { useEffect, useState } from "react";
import { TournamentHub } from "./TournamentHub";
import { TournamentDashboard } from "./TournamentDashboard";
import { findTournamentByCode } from "@/lib/tournament-engine";

export const Tournaments = () => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [spectator, setSpectator] = useState(false);

  // Deep-link: ?t=CODE auto-opens as spectator
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("t");
    if (!code) return;
    findTournamentByCode(code).then((t) => {
      if (t) { setOpenId(t.id); setSpectator(true); }
    }).catch(() => {});
  }, []);

  if (openId) return <TournamentDashboard tournamentId={openId} spectator={spectator} onExit={() => { setOpenId(null); setSpectator(false); }} />;
  return <TournamentHub onOpen={(id, spec) => { setOpenId(id); setSpectator(!!spec); }} />;
};