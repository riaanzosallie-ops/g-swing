import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlayer } from "@/lib/gswing-store";
import { User } from "lucide-react";

export const Profile = () => {
  const [p, setP] = usePlayer();
  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <User className="h-6 w-6 text-gold" />
        <h2 className="font-serif text-2xl text-gradient-gold">Profile</h2>
      </div>
      <Card className="gradient-card border-gold/20 p-4 space-y-3">
        {[
          ["name", "Name"], ["handicap", "Handicap"], ["country", "Country"], ["homeCourse", "Home Course"], ["hand", "Dominant Hand"],
        ].map(([k, label]) => (
          <div key={k}>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
            <Input value={(p as any)[k]} onChange={(e) => setP({ ...p, [k]: k === "handicap" ? Number(e.target.value) : e.target.value })}
              className="mt-1 border-gold/20 bg-background/40" />
          </div>
        ))}
      </Card>
      <Card className="gradient-card border-gold/20 p-4">
        <p className="font-serif text-base text-foreground">Linked Players</p>
        <p className="mt-1 text-xs text-muted-foreground">Riaan · Nievo · Toto · Docco</p>
      </Card>
    </div>
  );
};