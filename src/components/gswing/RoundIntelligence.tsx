import { Card } from "@/components/ui/card";
import { Activity, Flag, Target as TargetIcon, TrendingUp, Wind } from "lucide-react";
import type { RoundStats, StoredShot } from "@/lib/shot-tracker";

function pct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function RoundIntelligence({
  stats,
  loading,
}: {
  stats: RoundStats | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="gradient-card border-gold/20 p-3 text-xs text-muted-foreground">
        Loading round intelligence…
      </Card>
    );
  }
  if (!stats || stats.totalShots === 0) {
    return (
      <Card className="gradient-card border-gold/20 p-3">
        <div className="mb-1 flex items-center gap-2">
          <Activity className="h-4 w-4 text-gold" />
          <p className="font-serif text-sm">Round Intelligence</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Start tracking shots to build live round stats. Every Start Shot → End Shot
          is stored and turned into fairways hit, GIR, scrambling, putts and club
          averages.
        </p>
      </Card>
    );
  }

  const fwy = stats.fairwaysHit;
  const gir = stats.greensInRegulation;
  const scr = stats.scrambling;
  const miss = stats.missPattern;
  const totalMiss = miss.left + miss.right + miss.short + miss.long;

  return (
    <Card className="gradient-card border-gold/20 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-gold" />
        <p className="font-serif text-sm">Round Intelligence</p>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {stats.totalShots} shots · {stats.totalHoles} hole{stats.totalHoles === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat
          label="Fairways"
          value={fwy != null ? `${fwy}/${stats.fairwayAttempts}` : "—"}
          sub={fwy != null ? pct(fwy, stats.fairwayAttempts) : "no geom"}
        />
        <Stat
          label="GIR"
          value={gir != null ? `${gir}/${stats.girAttempts}` : "—"}
          sub={gir != null ? pct(gir, stats.girAttempts) : "no geom"}
        />
        <Stat
          label="Scramble"
          value={scr ? `${scr.saves}/${scr.opportunities}` : "—"}
          sub={scr ? pct(scr.saves, scr.opportunities) : "no geom"}
        />
        <Stat label="Putts" value={String(stats.putts)} sub="recorded" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Avg Drive"
          value={stats.averageDriveYards != null ? `${stats.averageDriveYards}y` : "—"}
          sub={stats.averageDriveYards != null ? "from real shots" : "no drives yet"}
          icon={<TrendingUp className="h-3.5 w-3.5 text-gold" />}
        />
        <Stat
          label="Longest Drive"
          value={stats.longestDriveYards != null ? `${stats.longestDriveYards}y` : "—"}
          sub={stats.longestDriveYards != null ? "this round" : "—"}
          icon={<Flag className="h-3.5 w-3.5 text-gold" />}
        />
      </div>

      {stats.clubs.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Club distances (this round)
          </p>
          <div className="space-y-1">
            {stats.clubs.slice(0, 5).map((c) => (
              <div
                key={c.club}
                className="flex items-center justify-between rounded border border-gold/15 bg-background/40 px-2 py-1 text-xs"
              >
                <span className="font-medium text-foreground">{c.club}</span>
                <span className="text-muted-foreground">
                  avg <span className="font-serif text-gold">{c.avg}y</span> · long{" "}
                  {c.longest}y · ×{c.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalMiss > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Wind className="h-3 w-3" /> Miss pattern
          </p>
          <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
            <MissCell label="Left" v={miss.left} t={totalMiss} />
            <MissCell label="Right" v={miss.right} t={totalMiss} />
            <MissCell label="Short" v={miss.short} t={totalMiss} />
            <MissCell label="Long" v={miss.long} t={totalMiss} />
          </div>
        </div>
      )}

      <ShotHistory shots={stats.shotHistory.slice(0, 8)} />
    </Card>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded border border-gold/15 bg-background/40 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-serif text-lg text-gold leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function MissCell({ label, v, t }: { label: string; v: number; t: number }) {
  return (
    <div className="rounded border border-gold/10 bg-background/40 py-1">
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className="font-serif text-sm text-gold">{v}</div>
      <div className="text-[9px] text-muted-foreground">{pct(v, t)}</div>
    </div>
  );
}

function ShotHistory({ shots }: { shots: StoredShot[] }) {
  if (!shots.length) return null;
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <TargetIcon className="h-3 w-3" /> Recent shots
      </p>
      <div className="space-y-1">
        {shots.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded border border-gold/10 bg-background/30 px-2 py-1 text-[11px]"
          >
            <span className="text-muted-foreground">
              H{s.hole_number ?? "—"} · #{s.shot_number ?? "—"}
            </span>
            <span className="text-foreground">{s.club ?? "—"}</span>
            <span className="font-serif text-gold">
              {s.distance_yards != null ? `${Math.round(s.distance_yards)}y` : "—"}
            </span>
            <span className="text-muted-foreground">{fmtTime(s.taken_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}