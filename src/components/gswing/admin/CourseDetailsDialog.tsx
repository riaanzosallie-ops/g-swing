// CourseDetails — shows the essentials for a G-Swing course and offers
// a single, prominent "Activate Course" action. Activating the course:
//   1. Persists it as the user's active course (localStorage).
//   2. Opens Live GPS so the round starts on Hole 1 immediately.
//
// Kept dependency-light so it can be launched from any surface
// (Manage Courses, Dashboard, GPS empty state).

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Flag, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setActiveCourse } from "@/lib/active-course";

export interface CourseDetailsInput {
  id: string;
  name: string;
  source: "mapped" | "golfapi" | "catalog";
  city?: string | null;
  country?: string | null;
  holes?: number | null;
  lat?: number | null;
  lng?: number | null;
  provider?: string | null;
  lastSynced?: string | null;
  mappedHoles?: number;
  premiumHoles?: number;
}

export function CourseDetailsDialog({
  course,
  open,
  onOpenChange,
  onActivated,
}: {
  course: CourseDetailsInput | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onActivated?: (id: string) => void;
}) {
  const [teeCount, setTeeCount] = useState<number | null>(null);
  const [coordCount, setCoordCount] = useState<number | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (!open || !course || course.source !== "golfapi") {
      setTeeCount(null);
      setCoordCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [tees, coords] = await Promise.all([
        supabase.from("golfapi_tees").select("id", { count: "exact", head: true }).eq("course_id", course.id),
        supabase.from("golfapi_coordinates").select("id", { count: "exact", head: true }).eq("course_id", course.id),
      ]);
      if (cancelled) return;
      setTeeCount(tees.count ?? 0);
      setCoordCount(coords.count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [open, course]);

  if (!course) return null;

  const activate = () => {
    setActivating(true);
    try {
      setActiveCourse({
        id: course.id,
        name: course.name,
        source: course.source,
        city: course.city ?? null,
        country: course.country ?? null,
        holes: course.holes ?? 18,
      });
      toast.success(`${course.name} activated`);
      onActivated?.(course.id);
      onOpenChange(false);
      // Route straight into Live GPS.
      window.location.href = "/?view=gps";
    } finally {
      setActivating(false);
    }
  };

  const lastSynced = course.lastSynced
    ? new Date(course.lastSynced).toLocaleString()
    : "Never";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-gold/30 bg-emerald-950/95">
        <DialogHeader>
          <DialogTitle className="font-serif text-gold">{course.name}</DialogTitle>
          <DialogDescription className="text-xs text-foreground/70">
            {[course.city, course.country].filter(Boolean).join(" · ") || "Location not supplied"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-gold/20 bg-black/30 p-3 text-[11px]">
            <div>
              <p className="text-gold/70">Holes</p>
              <p className="font-serif text-lg text-foreground">{course.holes ?? 18}</p>
            </div>
            {course.source === "mapped" && (
              <>
                <div>
                  <p className="text-gold/70">Mapped</p>
                  <p className="font-serif text-lg text-foreground">{course.mappedHoles ?? 0}/{course.holes ?? 18}</p>
                </div>
                <div>
                  <p className="text-gold/70">Premium ready</p>
                  <p className="font-serif text-lg text-foreground">{course.premiumHoles ?? 0}/{course.holes ?? 18}</p>
                </div>
                <div>
                  <p className="text-gold/70">Provider</p>
                  <p className="text-foreground/90">{course.provider ?? "Manual"}</p>
                </div>
              </>
            )}
            {course.source === "golfapi" && (
              <>
                <div>
                  <p className="text-gold/70">Tee boxes</p>
                  <p className="font-serif text-lg text-foreground">{teeCount ?? "—"}</p>
                </div>
                <div>
                  <p className="text-gold/70">GPS coordinates</p>
                  <p className="font-serif text-lg text-foreground">{coordCount ?? "—"}</p>
                </div>
                <div>
                  <p className="text-gold/70">Source</p>
                  <p className="text-foreground/90">GolfAPI.io cache</p>
                </div>
              </>
            )}
            <div className="col-span-2">
              <p className="text-gold/70">Last synced</p>
              <p className="text-foreground/90">{lastSynced}</p>
            </div>
            {typeof course.lat === "number" && typeof course.lng === "number" && (
              <div className="col-span-2">
                <p className="text-gold/70 flex items-center gap-1"><MapPin className="h-3 w-3" /> Coordinates</p>
                <p className="text-foreground/80">{course.lat.toFixed(4)}, {course.lng.toFixed(4)}</p>
              </div>
            )}
          </div>

          <Button
            onClick={activate}
            disabled={activating}
            className="w-full gap-2 bg-gold py-6 text-base font-semibold text-black hover:bg-gold/90"
          >
            {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            Activate Course
          </Button>
          <p className="flex items-center justify-center gap-1 text-center text-[10px] text-foreground/60">
            <Flag className="h-3 w-3" /> Opens Live GPS on Hole 1 with this course set as active.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}