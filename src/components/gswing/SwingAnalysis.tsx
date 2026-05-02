import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Upload, Sparkles, Loader2, History } from "lucide-react";
import { useSwings } from "@/lib/gswing-store";
import { toast } from "sonner";

export const SwingAnalysis = () => {
  const [swings, setSwings] = useSwings();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [club, setClub] = useState("7 Iron");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const onPick = (f: File | null) => {
    setFile(f); setResult(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!file) { toast.error("Add a swing video first"); return; }
    setLoading(true); setResult(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ace-swing-analysis`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ notes, playerName: "Riaan", handedness: "Right", club }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Analysis failed");
      setResult(data.analysis);
      setSwings([{ id: crypto.randomUUID(), date: new Date().toISOString().slice(0,10), club, notes, analysis: data.analysis }, ...swings]);
      toast.success("ACE has analysed your swing");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <Video className="h-6 w-6 text-gold" />
        <h2 className="font-serif text-2xl text-gradient-gold">Swing Analysis</h2>
      </div>

      <input ref={inputRef} type="file" accept="video/*" hidden onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      <input ref={camRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => onPick(e.target.files?.[0] ?? null)} />

      {preview ? (
        <Card className="gradient-card border-gold/30 p-2">
          <video src={preview} controls className="w-full rounded-lg" />
          <div className="mt-2 flex justify-between p-2 text-xs text-muted-foreground">
            <span>{file?.name}</span>
            <button onClick={() => onPick(null)} className="text-gold">Replace</button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => inputRef.current?.click()} variant="outline" className="h-24 flex-col gap-2 border-gold/40">
            <Upload className="h-6 w-6 text-gold" /> Upload Video
          </Button>
          <Button onClick={() => camRef.current?.click()} className="h-24 flex-col gap-2 gradient-gold text-primary-foreground">
            <Video className="h-6 w-6" /> Record Swing
          </Button>
        </div>
      )}

      <Card className="gradient-card border-gold/15 p-3 space-y-2">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Club Used</label>
          <select value={club} onChange={(e) => setClub(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gold/20 bg-background/40 p-2 text-sm">
            {["Driver","3 Wood","5 Wood","4 Hybrid","5 Iron","6 Iron","7 Iron","8 Iron","9 Iron","PW","52° Wedge","56° Wedge","60° Wedge"].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Notes for ACE</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="e.g. ball flying right, lost tempo on transition…"
            className="mt-1 w-full rounded-lg border border-gold/20 bg-background/40 p-2 text-sm" />
        </div>
      </Card>

      <Button onClick={submit} disabled={loading} className="w-full h-12 gradient-gold text-primary-foreground shadow-gold">
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> ACE is analysing…</> : <><Sparkles className="mr-2 h-4 w-4" /> Submit to ACE</>}
      </Button>

      {result && (
        <Card className="gradient-card border-gold/40 p-4 shadow-gold animate-float-up">
          <p className="text-[10px] uppercase tracking-widest text-gold/80">ACE Swing Report</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{result}</pre>
        </Card>
      )}

      {swings.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><History className="h-4 w-4" /> History</div>
          <div className="space-y-2">
            {swings.slice(0, 5).map((s) => (
              <Card key={s.id} className="gradient-card border-gold/10 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gold font-semibold">{s.club}</span>
                  <span className="text-muted-foreground">{s.date}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-muted-foreground">{s.analysis.slice(0, 140)}…</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};