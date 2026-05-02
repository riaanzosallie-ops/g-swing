import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

const PROS = [
  { name: "Scottie Scheffler", tour: "PGA", driver: "TaylorMade Qi10 (8°)", irons: "TaylorMade P7TW", wedges: "Vokey SM10", putter: "Scotty Cameron Phantom X 5" },
  { name: "Rory McIlroy", tour: "PGA", driver: "TaylorMade Qi10", irons: "TaylorMade Rors Proto", wedges: "TaylorMade MG4", putter: "TaylorMade Spider Tour X" },
  { name: "Jon Rahm", tour: "LIV", driver: "Callaway Paradym AI Smoke", irons: "Callaway Apex TCB", wedges: "Callaway Jaws Raw", putter: "Odyssey White Hot OG #7" },
  { name: "Bryson DeChambeau", tour: "LIV", driver: "Krank Formula Fire X", irons: "Avoda Prototype", wedges: "Ping Glide Forged Pro", putter: "LAB Golf DF3" },
  { name: "Brooks Koepka", tour: "LIV", driver: "Srixon ZX5 LS Mk II", irons: "Srixon ZX7 Mk II", wedges: "Cleveland RTX 6 ZipCore", putter: "TaylorMade Spider Tour X" },
  { name: "Viktor Hovland", tour: "PGA", driver: "Ping G430 LST", irons: "Ping i230", wedges: "Ping S159", putter: "Ping PLD Anser 2D" },
];

export const ProsBags = () => (
  <div className="space-y-4 pb-28">
    <div className="flex items-center gap-3">
      <Trophy className="h-6 w-6 text-gold" />
      <h2 className="font-serif text-2xl text-gradient-gold">Pros' Bags</h2>
    </div>
    <p className="text-xs text-muted-foreground">Latest gear from PGA & LIV stars — ACE can recommend variants from your bag.</p>

    <div className="space-y-3">
      {PROS.map((p) => (
        <Card key={p.name} className="gradient-card border-gold/15 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-lg text-gold">{p.name}</p>
              <span className="text-[10px] uppercase tracking-widest rounded-full border border-gold/30 px-2 py-0.5 text-muted-foreground">{p.tour} Tour</span>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <div><dt className="text-muted-foreground">Driver</dt><dd className="text-foreground">{p.driver}</dd></div>
            <div><dt className="text-muted-foreground">Irons</dt><dd className="text-foreground">{p.irons}</dd></div>
            <div><dt className="text-muted-foreground">Wedges</dt><dd className="text-foreground">{p.wedges}</dd></div>
            <div><dt className="text-muted-foreground">Putter</dt><dd className="text-foreground">{p.putter}</dd></div>
          </dl>
        </Card>
      ))}
    </div>
  </div>
);