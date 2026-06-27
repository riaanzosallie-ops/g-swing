import { useState } from "react";
import { Splash } from "@/components/gswing/Splash";
import { Dashboard } from "@/components/gswing/Dashboard";
import { GpsMap } from "@/components/gswing/GpsMap";
import { MyBag } from "@/components/gswing/MyBag";
import { SwingAnalysis } from "@/components/gswing/SwingAnalysis";
import { Scorecard } from "@/components/gswing/Scorecard";
import { ProsBags } from "@/components/gswing/ProsBags";
import { News } from "@/components/gswing/News";
import { Stats } from "@/components/gswing/Stats";
import { Profile } from "@/components/gswing/Profile";
import { ClubLink } from "@/components/gswing/ClubLink";
import { AceCaddie } from "@/components/gswing/AceCaddie";
import { Arena } from "@/components/gswing/Arena";
import { LiveDashboard } from "@/components/gswing/LiveDashboard";
import { RoundChat } from "@/components/gswing/RoundChat";
import { Roast } from "@/components/gswing/Roast";
import { FairwayMemories } from "@/components/gswing/FairwayMemories";
import { Tournaments } from "@/components/gswing/tournament/Tournaments";
import { Home, MapPin, Trophy, Target, User, ChevronLeft, Film } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "gps", label: "GPS", icon: MapPin },
  { id: "tournament", label: "Events", icon: Trophy },
  { id: "memories", label: "Memories", icon: Film },
  { id: "scorecard", label: "Score", icon: Target },
  { id: "profile", label: "Profile", icon: User },
];

const TITLES: Record<string, string> = {
  home: "G Swing", gps: "Live GPS", bag: "My Bag", scorecard: "Scorecard",
  swing: "Swing Analysis", pros: "Pros' Bags", news: "Tour News",
  stats: "Performance", profile: "Profile", clublink: "Club-Link",
  arena: "Betting Arena", live: "Live Dashboard", chat: "Round Chat", roast: "ACE Roast",
  memories: "Fairway Memories", tournament: "Tournaments",
};

const Index = () => {
  const [splashGone, setSplashGone] = useState(false);
  const [view, setView] = useState("home");

  if (!splashGone) return <Splash onEnter={() => setSplashGone(true)} />;

  const showBack = !NAV.some((n) => n.id === view);

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gold/15 bg-background/85 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {showBack && (
            <button onClick={() => setView("home")} className="-ml-2 rounded-full p-1 text-gold">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="font-serif text-lg text-gradient-gold">{TITLES[view] ?? "G Swing"}</h1>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">LinkMe</span>
      </header>

      <main className="px-4 py-4">
        {view === "home" && <Dashboard go={setView} />}
        {view === "gps" && <GpsMap />}
        {view === "bag" && <MyBag go={setView} />}
        {view === "swing" && <SwingAnalysis />}
        {view === "scorecard" && <Scorecard />}
        {view === "pros" && <ProsBags />}
        {view === "news" && <News />}
        {view === "stats" && <Stats />}
        {view === "profile" && <Profile />}
        {view === "clublink" && <ClubLink />}
        {view === "arena" && <Arena go={setView} />}
        {view === "live" && <LiveDashboard go={setView} />}
        {view === "chat" && <RoundChat />}
        {view === "roast" && <Roast />}
        {view === "memories" && <FairwayMemories />}
        {view === "tournament" && <Tournaments />}
      </main>

      <AceCaddie />

      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-gold/20 bg-background/90 backdrop-blur-md">
        <div className="grid grid-cols-6 px-2 py-2">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] transition-colors",
                view === n.id ? "text-gold" : "text-muted-foreground hover:text-foreground"
              )}>
              <n.icon className="h-5 w-5" />
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Index;
