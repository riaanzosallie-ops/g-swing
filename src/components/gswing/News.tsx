import { Card } from "@/components/ui/card";
import { Newspaper, Calendar } from "lucide-react";

const EVENTS = [
  { name: "The Masters 2026", date: "Apr 9–12", venue: "Augusta National", note: "Field announced — Scheffler defends." },
  { name: "PGA Championship", date: "May 14–17", venue: "Aronimink GC", note: "Practice rounds open Monday." },
  { name: "U.S. Open", date: "Jun 18–21", venue: "Shinnecock Hills", note: "Qualifying brackets in May." },
  { name: "The Open Championship", date: "Jul 16–19", venue: "Royal Birkdale", note: "Links setup confirmed by R&A." },
  { name: "LIV Golf Riyadh", date: "Mar 6–8", venue: "Riyadh GC", note: "Rahm and Koepka headline." },
  { name: "DP World Tour Championship", date: "Nov 12–15", venue: "Jumeirah Golf Estates · Earth", note: "Season finale, Dubai." },
];

const HEADLINES = [
  "Scheffler signs new TaylorMade deal — keeps Qi10 in play",
  "DP World Tour announces expanded Middle East swing for 2026",
  "Rory tweaks wedge setup ahead of PGA Championship",
  "LIV–PGA framework agreement nears completion, sources say",
];

export const News = () => (
  <div className="space-y-5 pb-28">
    <div className="flex items-center gap-3">
      <Newspaper className="h-6 w-6 text-gold" />
      <h2 className="font-serif text-2xl text-gradient-gold">Tour News</h2>
    </div>

    <section>
      <h3 className="mb-2 text-[10px] uppercase tracking-widest text-gold/80">Upcoming Major Events</h3>
      <div className="space-y-2">
        {EVENTS.map((e) => (
          <Card key={e.name} className="gradient-card border-gold/15 p-3 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-gold">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-serif text-base text-foreground">{e.name}</p>
              <p className="text-[11px] text-gold">{e.date} · {e.venue}</p>
              <p className="text-xs text-muted-foreground">{e.note}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>

    <section>
      <h3 className="mb-2 text-[10px] uppercase tracking-widest text-gold/80">Headlines</h3>
      <div className="space-y-2">
        {HEADLINES.map((h) => (
          <Card key={h} className="gradient-card border-gold/10 p-3 text-sm text-foreground">{h}</Card>
        ))}
      </div>
    </section>
  </div>
);