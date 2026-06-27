// G Swing — Post-Round Experience.
// Consumes a RoundExperienceModel and surfaces every Slice 1 deliverable
// in one place: Replay Studio launcher, Signature Moments carousel, and
// the reusable Experience Timeline.

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Award, Film, Sparkles, TimerReset } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReplayStudio } from "@/components/gswing/experience/ReplayStudio";
import { SignatureMomentCard } from "@/components/gswing/experience/SignatureMomentCard";
import { ExperienceTimeline } from "@/components/gswing/experience/ExperienceTimeline";
import { StoryView } from "@/components/gswing/experience/StoryView";
import { MomentumView } from "@/components/gswing/experience/MomentumView";
import { CoachView } from "@/components/gswing/experience/CoachView";
import type {
  RoundExperienceModel,
  SignatureMoment,
} from "@/lib/experience/experience-engine";

interface Props {
  open: boolean;
  onClose: () => void;
  model: RoundExperienceModel;
}

export function PostRoundExperience({ open, onClose, model }: Props) {
  const [replayOpen, setReplayOpen] = useState(false);
  const [focusShotId, setFocusShotId] = useState<string | null>(null);

  const onReplayMoment = (m: SignatureMoment) => {
    setFocusShotId(m.shot_ids[0] ?? null);
    setReplayOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="gradient-card max-h-[92vh] w-[min(100vw-1rem,42rem)] max-w-[42rem] overflow-y-auto border-gold/30 p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-gold">
              <Sparkles className="h-4 w-4" />
              Your Round Experience
              <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                {model.round.course_name ?? "Round"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {!model.has_sufficient_evidence ? (
            <Card className="border-gold/20 p-4 text-xs text-muted-foreground">
              Not enough data available. Track shots during your round to unlock Replay
              Studio, Signature Moments, and your Experience Timeline.
            </Card>
          ) : (
            <Tabs defaultValue="experience" className="w-full">
              <TabsList className="grid w-full grid-cols-4 gap-1 bg-background/60">
                <TabsTrigger value="experience" className="text-[11px]">Experience</TabsTrigger>
                <TabsTrigger value="story" className="text-[11px]">Story</TabsTrigger>
                <TabsTrigger value="momentum" className="text-[11px]">Momentum</TabsTrigger>
                <TabsTrigger value="coach" className="text-[11px]">Coach</TabsTrigger>
              </TabsList>

              <TabsContent value="experience" className="mt-3 space-y-5">
              <Card className="relative overflow-hidden border-gold/30 bg-gradient-to-br from-background to-background/60 p-4 shadow-elegant">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/20 blur-3xl"
                />
                <div className="relative flex items-start gap-3">
                  <span className="rounded-full border border-gold/40 bg-gold/10 p-2 text-gold">
                    <Film className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gold-soft">
                      Replay Studio
                    </p>
                    <h3 className="font-serif text-xl text-gradient-gold">
                      Watch your round
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      A cinematic replay built only from your real shots:
                      opening → course flyover → every shot → score updates →
                      round summary.
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{model.shots.length} shots</span>
                      <span>·</span>
                      <span>{model.holes.length} holes</span>
                      <span>·</span>
                      <span>{model.replay_timeline.length} replay beats</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="gradient-gold text-primary-foreground"
                    onClick={() => {
                      setFocusShotId(null);
                      setReplayOpen(true);
                    }}
                  >
                    <Film className="mr-1 h-3 w-3" />
                    Play
                  </Button>
                </div>
              </Card>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4 text-gold" />
                  <h3 className="font-serif text-lg text-gold">Signature Moments</h3>
                  <span className="ml-auto text-[10px] uppercase text-muted-foreground">
                    {model.signature_moments.length} detected
                  </span>
                </div>
                {model.signature_moments.length === 0 ? (
                  <Card className="border-gold/20 p-4 text-xs text-muted-foreground">
                    No signature moments detected for this round yet — keep
                    tagging shots and milestones will surface automatically.
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {model.signature_moments.map((m) => (
                      <SignatureMomentCard
                        key={m.id}
                        moment={m}
                        courseName={model.round.course_name}
                        onReplay={m.shot_ids[0] ? onReplayMoment : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <TimerReset className="h-4 w-4 text-gold" />
                  <h3 className="font-serif text-lg text-gold">Experience Timeline</h3>
                  <span className="ml-auto text-[10px] uppercase text-muted-foreground">
                    {model.player_timeline.length} items
                  </span>
                </div>
                <ExperienceTimeline items={model.player_timeline} />
              </section>
              </TabsContent>

              <TabsContent value="story" className="mt-3">
                <StoryView model={model} />
              </TabsContent>

              <TabsContent value="momentum" className="mt-3">
                <MomentumView model={model} />
              </TabsContent>

              <TabsContent value="coach" className="mt-3">
                <CoachView model={model} />
              </TabsContent>
            </Tabs>
          )}

          <div className="pt-3">
            <Button variant="outline" className="w-full border-gold/30" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ReplayStudio
        open={replayOpen}
        onClose={() => setReplayOpen(false)}
        model={model}
        focusShotId={focusShotId}
      />
    </>
  );
}
