// CourseSelectorSheet — premium course picker for G-Swing GPS.
// - Search by name / city
// - Nearby-first ordering with distance
// - Shows mapped-hole count + Premium Ready badge
// - Auto-detect prompt when player is within ~500m of a mapped course
// - Owner-only "Force Select Course" testing toggle
//
// Pure presentation + lightweight Supabase reads. Never mutates GPS,
// mapping or scoring logic — selection state is owned by the caller.

import { useEffect, useMemo, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Search,
  Navigation,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Crown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { haversineYards, type LatLng } from "@/lib/gps-utils";
import type { GolfCourse } from "@/lib/golf-gps-api";

const NEARBY_METERS = 500;
const MATCH_METERS = 350; // catalog ↔ mapped pairing radius

function metersBetween(a: LatLng, b: LatLng): number {
  return haversineYards(a, b) * 0.9144;
}

type MappedSummary = {
  id: string;
  name: string;
  center: LatLng;
  mappedHoles: number;
  premiumReady: boolean;
};

export type CourseSelectorSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: GolfCourse[];
  currentCourseId: string;
  playerPosition: LatLng | null;
  isOwner?: boolean;
  onSelect: (course: GolfCourse) => void;
  /** When true, "Cancel" is hidden so user must pick a course (start of round). */
  forcePick?: boolean;
};

export function CourseSelectorSheet({
  open,
  onOpenChange,
  courses,
  currentCourseId,
  playerPosition,
  isOwner,
  onSelect,
  forcePick,
}: CourseSelectorSheetProps) {
  const [query, setQuery] = useState("");
  const [mapped, setMapped] = useState<MappedSummary[]>([]);
  const [forceMode, setForceMode] = useState(false);

  // Load mapped-course summaries (name, center, holes mapped) once
  // per sheet open. Used to enrich rows with Premium Ready badges.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("gswing_course_maps")
        .select(
          "id, course_name, latitude, longitude, gswing_mapped_holes(count)",
        );
      if (cancelled || error || !data) return;
      const rows: MappedSummary[] = (data as Array<{
        id: string;
        course_name: string;
        latitude: number | null;
        longitude: number | null;
        gswing_mapped_holes?: Array<{ count: number }> | null;
      }>)
        .filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number")
        .map((r) => {
          const mappedHoles = r.gswing_mapped_holes?.[0]?.count ?? 0;
          return {
            id: r.id,
            name: r.course_name,
            center: { lat: r.latitude as number, lng: r.longitude as number },
            mappedHoles,
            premiumReady: mappedHoles >= 9,
          };
        });
      setMapped(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const enriched = useMemo(() => {
    return courses.map((c) => {
      const center = { lat: c.lat, lng: c.lng };
      const meters = playerPosition ? metersBetween(playerPosition, center) : null;
      // Match catalog course to a mapped course by name suffix or proximity.
      const match = mapped.find((m) => {
        if (
          m.name.toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(m.name.toLowerCase())
        ) {
          return true;
        }
        return metersBetween(m.center, center) <= MATCH_METERS;
      });
      return {
        course: c,
        meters,
        mappedHoles: match?.mappedHoles ?? 0,
        premiumReady: match?.premiumReady ?? false,
      };
    });
  }, [courses, mapped, playerPosition]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = enriched.filter(({ course }) => {
      if (!q) return true;
      return (
        course.name.toLowerCase().includes(q) ||
        course.city.toLowerCase().includes(q)
      );
    });
    matches.sort((a, b) => {
      if (a.meters == null && b.meters == null) return a.course.name.localeCompare(b.course.name);
      if (a.meters == null) return 1;
      if (b.meters == null) return -1;
      return a.meters - b.meters;
    });
    return matches;
  }, [enriched, query]);

  const nearbyCandidate = useMemo(() => {
    if (!playerPosition) return null;
    const withDist = filtered
      .filter((r) => r.meters != null && r.mappedHoles > 0)
      .sort((a, b) => (a.meters as number) - (b.meters as number));
    const top = withDist[0];
    if (!top || (top.meters as number) > NEARBY_METERS) return null;
    return top;
  }, [filtered, playerPosition]);

  const pick = (c: GolfCourse) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info("[GSWING][1] Course Selected", { id: c.id, name: c.name });
    }
    // Close first so the drawer animation cannot swallow the selection,
    // then commit on the next tick. Fixes "nothing happens" on some
    // mobile devices where the drawer close race-conditioned the parent
    // state update.
    onOpenChange(false);
    setTimeout(() => onSelect(c), 0);
  };

  const formatDist = (meters: number | null) => {
    if (meters == null) return "Distance unknown";
    if (meters < 1000) return `${Math.round(meters)} m away`;
    return `${(meters / 1000).toFixed(1)} km away`;
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o && forcePick) return; // can't dismiss before initial pick
        onOpenChange(o);
      }}
      dismissible={!forcePick}
    >
      <DrawerContent className="max-h-[92vh] border-gold/30 bg-gradient-to-b from-emerald-950/95 via-black/95 to-black/95">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2 font-serif text-base text-gradient-gold">
            <MapPin className="h-4 w-4 text-gold" /> Select Course
          </DrawerTitle>
          <DrawerDescription className="text-[11px] text-muted-foreground">
            Choose where you're playing. Nearby courses appear first.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col overflow-hidden px-4 pb-3">
          {nearbyCandidate && (
            <div className="mb-3 rounded-xl border border-gold/40 bg-gold/10 p-3 shadow-gold">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-gold/80">
                    You're here
                  </p>
                  <p className="truncate font-serif text-sm text-foreground">
                    You're at {nearbyCandidate.course.name}. Start here?
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDist(nearbyCandidate.meters)} ·{" "}
                    {nearbyCandidate.mappedHoles} holes mapped
                  </p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={() => pick(nearbyCandidate.course)}
                  className="gradient-gold text-primary-foreground"
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Use this course
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gold/40"
                  onClick={() => {
                    // Just focus the search field; rest of list is already shown.
                    const el = document.getElementById("gswing-course-search");
                    el?.focus();
                  }}
                >
                  Choose another
                </Button>
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="gswing-course-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by course or city"
              className="h-10 border-gold/20 bg-background/60 pl-9 text-sm"
            />
          </div>

          {isOwner && (
            <button
              type="button"
              onClick={() => setForceMode((v) => !v)}
              className={`mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px] transition ${
                forceMode
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-gold/20 text-muted-foreground hover:border-gold/40"
              }`}
            >
              <span className="flex items-center gap-2">
                <Crown className="h-3.5 w-3.5" />
                Force Select Course (Owner)
              </span>
              <span>{forceMode ? "On" : "Off"}</span>
            </button>
          )}

          <div className="mt-3 -mx-1 max-h-[55vh] overflow-y-auto px-1 pb-1">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gold/30 px-4 py-8 text-center text-xs text-muted-foreground">
                No courses match "{query}".
              </div>
            ) : (
              <ul className="space-y-1.5">
                {filtered.map(({ course, meters, mappedHoles, premiumReady }) => {
                  const selected = course.id === currentCourseId;
                  const disabled = !forceMode && isOwner !== true && mappedHoles === 0 && false;
                  // Note: we don't actually block selection (any course is
                  // playable via GPS fallback). The force toggle is shown to
                  // highlight that owners can test unmapped courses freely.
                  return (
                    <li key={course.id}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          pick(course);
                        }}
                        disabled={disabled}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99] ${
                          selected
                            ? "border-gold/60 bg-gold/10 shadow-gold"
                            : "border-gold/15 bg-background/40 hover:border-gold/40"
                        } disabled:opacity-50`}
                      >
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-950/60 text-gold">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {course.name}
                            </p>
                            {selected && (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-gold" />
                            )}
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {course.city}
                            {course.country ? ` · ${course.country}` : ""}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="h-5 border-gold/30 px-1.5 text-[9px] text-gold-soft"
                            >
                              <Navigation className="mr-1 h-2.5 w-2.5" />
                              {formatDist(meters)}
                            </Badge>
                            {mappedHoles > 0 && (
                              <Badge
                                variant="outline"
                                className="h-5 border-emerald-500/40 px-1.5 text-[9px] text-emerald-300"
                              >
                                {mappedHoles} mapped
                              </Badge>
                            )}
                            {premiumReady && (
                              <Badge className="h-5 gradient-gold px-1.5 text-[9px] text-primary-foreground">
                                <ShieldCheck className="mr-1 h-2.5 w-2.5" />
                                Premium Ready
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {!forcePick && (
            <div className="mt-3 border-t border-gold/10 pt-3">
              <Button
                type="button"
                variant="outline"
                className="w-full border-gold/40"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}