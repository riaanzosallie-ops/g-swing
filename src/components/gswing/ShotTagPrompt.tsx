import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SHOT_DIRECTIONS,
  SHOT_RESULTS,
  type ShotDirection,
  type ShotResult,
  type ShotTagInput,
} from "@/lib/shot-tracker";

interface Props {
  open: boolean;
  shotSummary?: string; // e.g. "Hole 4 · #2 · 7-Iron · 168y"
  onClose: () => void;
  onSave: (tags: ShotTagInput) => void | Promise<void>;
}

export function ShotTagPrompt({ open, shotSummary, onClose, onSave }: Props) {
  const [direction, setDirection] = useState<ShotDirection | null>(null);
  const [results, setResults] = useState<ShotResult[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDirection(null);
      setResults([]);
      setNotes("");
      setSaving(false);
    }
  }, [open]);

  const toggleResult = (r: ShotResult) =>
    setResults((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ direction, results, notes: notes.trim() || null });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gradient-card max-w-md border-gold/30">
        <DialogHeader>
          <DialogTitle className="font-serif text-gold">Tag this shot</DialogTitle>
        </DialogHeader>
        {shotSummary && (
          <p className="text-xs text-muted-foreground">{shotSummary}</p>
        )}

        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Direction
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SHOT_DIRECTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDirection(direction === d.id ? null : d.id)}
                className={`rounded-lg border px-2 py-2 text-sm font-semibold transition ${
                  direction === d.id
                    ? "border-gold bg-gold/20 text-gold"
                    : "border-gold/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Result (tap any that apply)
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {SHOT_RESULTS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleResult(r.id)}
                className={`rounded-md border px-1 py-2 text-[11px] font-semibold transition ${
                  results.includes(r.id)
                    ? "border-gold bg-gold/20 text-gold"
                    : "border-gold/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Notes (optional)
          </p>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 200))}
            placeholder="e.g. flushed it, downwind, pulled tee shot"
            className="bg-background/60"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 border-gold/30" onClick={onClose} disabled={saving}>
            Skip
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 gradient-gold text-primary-foreground"
          >
            {saving ? "Saving…" : "Save tag"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}