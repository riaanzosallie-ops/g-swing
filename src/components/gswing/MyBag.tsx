import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase, Plus, Trash2, Coins } from "lucide-react";
import { useBag, type Club } from "@/lib/gswing-store";
import { toast } from "sonner";

export const MyBag = ({ go }: { go: (id: string) => void }) => {
  const [bag, setBag] = useBag();

  const update = (id: string, patch: Partial<Club>) =>
    setBag(bag.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => setBag(bag.filter((c) => c.id !== id));
  const add = () => setBag([...bag, { id: crypto.randomUUID(), name: "New Club", type: "Iron", distance: 150, brand: "" }]);

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <Briefcase className="h-6 w-6 text-gold" />
        <h2 className="font-serif text-2xl text-gradient-gold">My Bag</h2>
      </div>
      <p className="text-xs text-muted-foreground">Tailor each club's carry distance — ACE uses these to recommend exactly what's in your bag.</p>

      <Card className="gradient-card border-gold/30 p-3">
        <div className="flex items-start gap-3">
          <Coins className="h-5 w-5 shrink-0 text-gold" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-foreground">Earn from these clubs on Club-Link</p>
            <p className="text-muted-foreground">List your set when you're not playing.</p>
          </div>
          <Button size="sm" onClick={() => go("clublink")} className="gradient-gold text-primary-foreground">List</Button>
        </div>
      </Card>

      <div className="space-y-2">
        {bag.map((c) => (
          <Card key={c.id} className="gradient-card border-gold/15 p-3">
            <div className="flex items-center gap-2">
              <Input value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} className="h-9 flex-1 border-gold/20 bg-background/40" />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={c.distance}
                  onChange={(e) => update(c.id, { distance: Number(e.target.value) })}
                  className="h-9 w-20 border-gold/20 bg-background/40 text-center"
                />
                <span className="text-xs text-muted-foreground">m</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(c.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {c.brand && <p className="mt-1 text-[10px] text-muted-foreground">{c.brand}</p>}
          </Card>
        ))}
      </div>

      <Button onClick={add} variant="outline" className="w-full border-gold/40"><Plus className="mr-2 h-4 w-4" /> Add Club</Button>
    </div>
  );
};