import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Film, Sparkles, Users, User as UserIcon, Share2, Download, Wand2, ChevronLeft, Image as ImageIcon, Trash2, Lock, Upload } from "lucide-react";
import { useRoundCam, useMemories, usePlayer, type RoundPhoto, type MomentTag, type CollageLayout, type FairwayMemory } from "@/lib/gswing-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TAGS: MomentTag[] = ["Great Shot", "Birdie/Eagle", "Funny", "Scenery", "Group", "Personal Best", "Partner"];
const LAYOUTS: CollageLayout[] = ["Classic", "Story", "Polaroid", "Minimal", "GroupWall"];

type Mode = "gallery" | "capture" | "choose" | "build" | "view";

const LOAD_STEPS = [
  "Reviewing your photos from today…",
  "Selecting your best moments…",
  "Pairing with your scorecard…",
  "Adding the finishing touches…",
];

export const FairwayMemories = () => {
  const [photos, setPhotos] = useRoundCam();
  const [memories, setMemories] = useMemories();
  const [player] = usePlayer();
  const [mode, setMode] = useState<Mode>("gallery");
  const [hole, setHole] = useState(1);
  const [activeMemory, setActiveMemory] = useState<FairwayMemory | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const todayPhotos = useMemo(
    () => photos.filter(p => Date.now() - new Date(p.ts).getTime() < 24 * 60 * 60 * 1000),
    [photos]
  );

  const onPick = async (files: FileList | null, source: "camera" | "upload" = "camera") => {
    if (!files?.length) return;
    const next: RoundPhoto[] = [];
    for (const f of Array.from(files)) {
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(f);
      });
      next.push({
        id: crypto.randomUUID(),
        dataUrl,
        hole,
        ts: new Date().toISOString(),
        quality: 0.6 + Math.random() * 0.4,
      });
    }
    setPhotos([...next, ...photos]);
    toast.success(
      source === "upload"
        ? `${next.length} photo${next.length > 1 ? "s" : ""} added from device`
        : `${next.length} photo${next.length > 1 ? "s" : ""} captured on Hole ${hole}`
    );
  };

  const tagPhoto = (id: string, tag: MomentTag) => {
    setPhotos(photos.map(p => p.id === id ? { ...p, tag, quality: Math.min(1, p.quality + 0.15) } : p));
  };

  const removePhoto = (id: string) => setPhotos(photos.filter(p => p.id !== id));

  /* ===== Header ===== */
  const Header = ({ title, sub }: { title: string; sub?: string }) => (
    <div className="flex items-center gap-2">
      {mode !== "gallery" && (
        <button onClick={() => setMode("gallery")} className="-ml-2 rounded-full p-1 text-gold">
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div>
        <h2 className="font-serif text-2xl text-gradient-gold">{title}</h2>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );

  /* ============ GALLERY ============ */
  if (mode === "gallery") {
    return (
      <div className="space-y-4 pb-28">
        <Header title="Fairway Memories" sub="Every round tells a story. We keep it forever." />

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setMode("capture")}
            className="gradient-card flex flex-col items-start gap-2 rounded-2xl border border-gold/20 p-4 text-left hover:border-gold/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-gold">
              <Camera className="h-5 w-5 text-primary-foreground" />
            </div>
            <p className="font-serif text-base">Round Cam</p>
            <p className="text-[10px] text-muted-foreground">{todayPhotos.length} photos today</p>
          </button>
          <button onClick={() => todayPhotos.length ? setMode("choose") : toast.error("Capture a few photos first")}
            className="relative overflow-hidden rounded-2xl border border-gold/30 p-4 text-left shadow-gold gradient-gold">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
            <p className="mt-2 font-serif text-base text-primary-foreground">Build My Memory</p>
            <p className="text-[10px] text-primary-foreground/80">One tap. ACE does the rest.</p>
            <span className="absolute inset-y-0 -left-10 w-10 -skew-x-12 bg-white/30 animate-shimmer" />
          </button>
        </div>

        <Card className="gradient-card border-gold/20 p-4">
          <p className="text-[10px] uppercase tracking-widest text-gold/80">Saved Collages</p>
          {memories.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No memories yet — capture your round and let ACE build one.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {memories.map(m => {
                const cover = photos.find(p => p.id === m.photoIds[0]);
                return (
                  <button key={m.id} onClick={() => { setActiveMemory(m); setMode("view"); }}
                    className="group overflow-hidden rounded-xl border border-gold/15 text-left">
                    <div className="aspect-square w-full overflow-hidden bg-secondary">
                      {cover ? <img src={cover.dataUrl} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        : <div className="flex h-full items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>}
                    </div>
                    <div className="p-2">
                      <p className="truncate font-serif text-xs">{m.course}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(m.date).toLocaleDateString()} · {m.mode}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="gradient-card border-gold/20 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-gold" />
            Group collages & Year in Review unlock with G Swing Elite.
          </div>
        </Card>
      </div>
    );
  }

  /* ============ CAPTURE ============ */
  if (mode === "capture") {
    return (
      <div className="space-y-4 pb-28">
        <Header title="Round Cam" sub="Tag the moment. ACE will remember it." />

        <Card className="gradient-card border-gold/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gold/80">Currently on</p>
              <p className="font-serif text-xl">Hole {hole}</p>
            </div>
            <div className="flex gap-1">
              {[1,3,6,9,12,15,18].map(h => (
                <button key={h} onClick={() => setHole(h)}
                  className={cn("h-8 w-8 rounded-full text-xs",
                    hole === h ? "gradient-gold text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                  {h}
                </button>
              ))}
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden
            onChange={(e) => onPick(e.target.files)} />
          <Button onClick={() => fileRef.current?.click()}
            className="mt-4 w-full gradient-gold text-primary-foreground" size="lg">
            <Camera className="mr-2 h-5 w-5" /> Capture Moment
          </Button>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          {todayPhotos.map(p => (
            <div key={p.id} className="group relative overflow-hidden rounded-lg border border-gold/15">
              <img src={p.dataUrl} className="aspect-square w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-1.5">
                <p className="text-[9px] text-gold">H{p.hole}{p.tag ? ` · ${p.tag}` : ""}</p>
              </div>
              <button onClick={() => removePhoto(p.id)}
                className="absolute right-1 top-1 rounded-full bg-background/70 p-1 opacity-0 group-hover:opacity-100">
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
              <select value={p.tag ?? ""} onChange={(e) => tagPhoto(p.id, e.target.value as MomentTag)}
                className="absolute left-1 top-1 rounded bg-background/70 px-1 text-[8px] text-foreground border border-gold/20">
                <option value="">Tag…</option>
                {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ============ CHOOSE solo/group ============ */
  if (mode === "choose") {
    return <ChooseMode onSolo={() => buildMemory("solo")} onGroup={() => buildMemory("group")} />;
  }

  /* ============ BUILD (loading) ============ */
  if (mode === "build") {
    return <BuildLoader />;
  }

  /* ============ VIEW ============ */
  if (mode === "view" && activeMemory) {
    return <CollageView memory={activeMemory} photos={photos}
      onLayout={(l) => {
        const updated = { ...activeMemory, layout: l };
        setActiveMemory(updated);
        setMemories(memories.map(m => m.id === updated.id ? updated : m));
      }} />;
  }

  function ChooseMode({ onSolo, onGroup }: { onSolo: () => void; onGroup: () => void }) {
    return (
      <div className="space-y-4 pb-28">
        <Header title="Who is this memory for?" />
        <button onClick={onSolo} className="w-full gradient-card rounded-2xl border border-gold/20 p-6 text-left hover:border-gold/50">
          <UserIcon className="h-6 w-6 text-gold" />
          <p className="mt-2 font-serif text-xl">Just Me</p>
          <p className="text-xs text-muted-foreground">Create my personal round keepsake.</p>
        </button>
        <button onClick={onGroup} className="w-full gradient-card rounded-2xl border border-gold/20 p-6 text-left hover:border-gold/50">
          <Users className="h-6 w-6 text-gold" />
          <p className="mt-2 font-serif text-xl">Our Group</p>
          <p className="text-xs text-muted-foreground">Build a group collage for everyone who played.</p>
        </button>
      </div>
    );
  }

  function BuildLoader() {
    const [step, setStep] = useState(0);
    useEffect(() => {
      const t = setInterval(() => setStep(s => Math.min(s + 1, LOAD_STEPS.length - 1)), 700);
      const to = setTimeout(() => clearInterval(t), 3000);
      return () => { clearInterval(t); clearTimeout(to); };
    }, []);
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 pb-28 text-center">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-gold" />
        </div>
        <p className="font-serif text-lg text-gradient-gold">{LOAD_STEPS[step]}</p>
        <p className="text-xs text-muted-foreground">ACE is curating your Fairway Memory…</p>
      </div>
    );
  }

  async function buildMemory(modeSel: "solo" | "group") {
    setMode("build");
    // AI curation: rank by quality + tag weight
    const tagWeight = (t?: MomentTag) =>
      t === "Birdie/Eagle" || t === "Personal Best" ? 0.4 :
      t === "Group" ? (modeSel === "group" ? 0.5 : 0.1) :
      t === "Great Shot" ? 0.25 : t === "Scenery" ? 0.15 : t ? 0.1 : 0;
    const ranked = [...todayPhotos]
      .map(p => ({ p, score: p.quality + tagWeight(p.tag) }))
      .sort((a, b) => b.score - a.score);
    const picks = ranked.slice(0, Math.max(6, Math.min(12, ranked.length))).map(r => r.p);

    const players = modeSel === "group"
      ? [
          { name: player.name, score: 74, par: 72 },
          { name: "Nievo", score: 78, par: 72 },
          { name: "Toto", score: 82, par: 72 },
          { name: "Docco", score: 76, par: 72 },
        ]
      : [{ name: player.name, score: 74, par: 72 }];

    let caption = modeSel === "solo"
      ? "What a round. You played your best golf when it mattered most. Remember this one."
      : "What a group. What a round. Here's the day you'll all remember.";
    try {
      const { data } = await supabase.functions.invoke("ace-chat", {
        body: {
          messages: [{
            role: "user",
            content: `Write a 1-2 sentence warm, premium golf memory caption for a ${modeSel} round at ${player.homeCourse}. ${
              modeSel === "group" ? "Acknowledge the group of friends." : `Player: ${player.name}, score 74 on par 72.`
            } Keep it under 30 words. No hashtags.`
          }],
        },
      });
      if (data?.reply) caption = String(data.reply).trim();
    } catch {}

    const memory: FairwayMemory = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      course: player.homeCourse,
      mode: modeSel,
      players,
      photoIds: picks.map(p => p.id),
      layout: modeSel === "group" ? "GroupWall" : "Classic",
      caption,
      badge: picks.some(p => p.tag === "Birdie/Eagle") ? "3 Birdies Today" : "New Personal Best",
    };

    setTimeout(() => {
      setMemories([memory, ...memories]);
      setActiveMemory(memory);
      setMode("view");
    }, 2800);
  }

  return null;
};

/* ============ Collage View ============ */
function CollageView({ memory, photos, onLayout }: {
  memory: FairwayMemory;
  photos: RoundPhoto[];
  onLayout: (l: CollageLayout) => void;
}) {
  const pics = memory.photoIds.map(id => photos.find(p => p.id === id)).filter(Boolean) as RoundPhoto[];
  const [typed, setTyped] = useState("");
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i++;
      setTyped(memory.caption.slice(0, i));
      if (i >= memory.caption.length) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [memory.caption]);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "G Swing Fairway Memory", text: memory.caption });
      } else {
        await navigator.clipboard.writeText(memory.caption);
        toast.success("Caption copied");
      }
    } catch {}
  };

  return (
    <div className="space-y-4 pb-28 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">Fairway Memory</p>
          <h2 className="font-serif text-2xl text-gradient-gold">{memory.course}</h2>
          <p className="text-[11px] text-muted-foreground">{new Date(memory.date).toLocaleDateString()}</p>
        </div>
        {memory.badge && <Badge className="gradient-gold text-primary-foreground">{memory.badge}</Badge>}
      </div>

      <Card className="gradient-card overflow-hidden border-gold/30 p-3 shadow-gold">
        {memory.layout === "Story" && (
          <div className="space-y-2">
            {pics[0] && <img src={pics[0].dataUrl} className="aspect-video w-full rounded-lg object-cover" />}
            <div className="grid grid-cols-3 gap-2">
              {pics.slice(1, 7).map(p => <img key={p.id} src={p.dataUrl} className="aspect-square w-full rounded object-cover" />)}
            </div>
          </div>
        )}
        {memory.layout === "Polaroid" && (
          <div className="relative grid grid-cols-2 gap-3 bg-[hsl(var(--background))]/50 p-2">
            {pics.slice(0, 8).map((p, i) => (
              <div key={p.id} className="rounded bg-background p-1.5 shadow-md"
                style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg)` }}>
                <img src={p.dataUrl} className="aspect-square w-full object-cover" />
              </div>
            ))}
          </div>
        )}
        {memory.layout === "Minimal" && (
          <div className="grid grid-cols-2 gap-2">
            {pics.slice(0, 2).map(p => <img key={p.id} src={p.dataUrl} className="aspect-[3/4] w-full rounded object-cover" />)}
          </div>
        )}
        {memory.layout === "GroupWall" && (
          <div className="grid grid-cols-2 gap-2">
            {memory.players.map((pl, i) => {
              const pic = pics[i % pics.length];
              return (
                <div key={pl.name} className="overflow-hidden rounded border border-gold/15">
                  {pic && <img src={pic.dataUrl} className="aspect-square w-full object-cover" />}
                  <div className="p-1.5">
                    <p className="font-serif text-xs">{pl.name}</p>
                    <p className="text-[10px] text-gold">{pl.score} / par {pl.par}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {memory.layout === "Classic" && (
          <div className="grid grid-cols-3 gap-2">
            {pics.slice(0, 9).map(p => <img key={p.id} src={p.dataUrl} className="aspect-square w-full rounded object-cover" />)}
          </div>
        )}

        <div className="mt-3 rounded-lg border border-gold/20 bg-background/50 p-3">
          <p className="text-[10px] uppercase tracking-widest text-gold/80">Scorecard</p>
          <div className="mt-1 space-y-1">
            {memory.players.map(pl => (
              <div key={pl.name} className="flex justify-between text-xs">
                <span className="font-serif">{pl.name}</span>
                <span className="text-gold">{pl.score} <span className="text-muted-foreground">/ par {pl.par}</span></span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 px-2 font-serif italic text-foreground">"{typed}<span className="animate-pulse">|</span>"</p>
        <p className="mt-2 text-right text-[9px] uppercase tracking-widest text-gold/60">G Swing · LinkMe</p>
      </Card>

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Layout</p>
        <div className="flex flex-wrap gap-2">
          {LAYOUTS.map(l => (
            <button key={l} onClick={() => onLayout(l)}
              className={cn("rounded-full px-3 py-1 text-[11px] border",
                memory.layout === l ? "gradient-gold text-primary-foreground border-transparent" : "border-gold/30 text-muted-foreground")}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={share} variant="outline" className="border-gold/40">
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
        <Button onClick={() => toast.success("Saved to gallery")} className="gradient-gold text-primary-foreground">
          <Download className="mr-2 h-4 w-4" /> Save
        </Button>
      </div>
    </div>
  );
}

/* Floating shortcut button used elsewhere */
export const RoundCamShortcut = ({ onOpen }: { onOpen: () => void }) => (
  <button onClick={onOpen}
    className="fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full gradient-gold shadow-gold">
    <Camera className="h-5 w-5 text-primary-foreground" />
  </button>
);