// Owner-only Course Health Dashboard (Phase 3).
// ----------------------------------------------
// Aggregates the same CourseSummary rows already loaded by Manage
// Courses into a single at-a-glance panel: cached count, auto vs
// manual holes, average quality, holes needing enhancement, and last
// sync. Deliberately zero extra network calls — reuses the summary
// already in memory.

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Activity, CloudDownload, MapPin, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import type { CourseSummary } from "@/lib/gswing-course-status";
import { badgeToneClasses, badgeForScore, sourceLabel, type CourseSource } from "@/lib/gswing-hole-quality";

/** Estimate a per-course quality score from summary counts (no extra queries). */
function estimateCourseScore(c: CourseSummary): {
  score: number;
  auto: number;
  manual: number;
  needs: number;
  source: CourseSource;
} {
  const total = c.statusInfo.holesTotal || 18;
  const manual = c.statusInfo.holesMapped;
  const premium = c.statusInfo.premiumHoles;
  const auto = Math.max(0, total - manual);
  // Rough per-hole weighting matched to scoreHole():
  //   premium mapped hole ≈ 95, mapped-not-premium ≈ 70, auto ≈ 85.
  const perHole = premium * 95 + (manual - premium) * 70 + auto * 85;
  const score = total > 0 ? Math.round(perHole / total) : 0;
  const needs = manual - premium + (auto > 0 && score < 75 ? auto : 0);
  const source: CourseSource =
    manual > 0 && auto > 0 ? "mixed"
      : manual > 0 ? "manual"
      : "auto";
  return { score, auto, manual, needs: Math.max(0, needs), source };
}

export function CourseHealthDashboard({
  courses,
  onOpenMapper,
}: {
  courses: CourseSummary[];
  onOpenMapper?: (courseId: string) => void;
}) {
  const rows = useMemo(
    () =>
      courses.map((c) => ({
        course: c,
        stats: estimateCourseScore(c),
      })),
    [courses],
  );

  const totals = useMemo(() => {
    let auto = 0, manual = 0, needs = 0, scoreSum = 0;
    for (const r of rows) {
      auto += r.stats.auto;
      manual += r.stats.manual;
      needs += r.stats.needs;
      scoreSum += r.stats.score;
    }
    const avg = rows.length ? Math.round(scoreSum / rows.length) : 0;
    return { auto, manual, needs, avg, cached: rows.length };
  }, [rows]);

  const badge = badgeForScore(totals.avg);

  if (courses.length === 0) return null;

  return (
    <Card className="border-gold/25 bg-gradient-to-br from-emerald-950/40 via-black/45 to-emerald-950/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-gold" />
          <h3 className="font-serif text-sm text-gold">Course Health</h3>
          <span className="rounded-full border border-gold/40 bg-black/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-gold-soft">
            Owner
          </span>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${badgeToneClasses(badge.tone)}`}>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
          {badge.label} · {totals.avg}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={<CloudDownload className="h-3.5 w-3.5" />} label="Cached" value={totals.cached} />
        <Stat icon={<Sparkles className="h-3.5 w-3.5" />} label="Auto holes" value={totals.auto} />
        <Stat icon={<MapPin className="h-3.5 w-3.5" />} label="Manual holes" value={totals.manual} />
        <Stat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Need enhance" value={totals.needs} tone={totals.needs > 0 ? "amber" : "muted"} />
      </div>

      <div className="mt-3 space-y-1.5">
        {rows.slice(0, 6).map(({ course, stats }) => {
          const b = badgeForScore(stats.score);
          return (
            <div
              key={course.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] text-white/90">{course.course_name}</div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/50">
                  {sourceLabel(stats.source)}
                  {course.last_synced && (
                    <> · Synced {relTime(course.last_synced)}</>
                  )}
                </div>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${badgeToneClasses(b.tone)}`}>
                {stats.score}%
              </span>
              {b.stronglyRecommend && onOpenMapper && (
                <button
                  type="button"
                  onClick={() => onOpenMapper(course.id)}
                  className="shrink-0 rounded-full border border-amber-400/50 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-100 transition-all active:scale-95"
                >
                  Enhance
                </button>
              )}
            </div>
          );
        })}
        {rows.length > 6 && (
          <div className="text-center text-[10px] uppercase tracking-[0.2em] text-white/40">
            + {rows.length - 6} more course{rows.length - 6 === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "amber" | "muted";
}) {
  const valueClass =
    tone === "amber" ? "text-amber-200" : tone === "muted" ? "text-white/50" : "text-gold";
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-white/50">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 font-serif text-lg ${valueClass}`}>{value}</div>
    </div>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}