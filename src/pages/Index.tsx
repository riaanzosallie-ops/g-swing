import { useEffect, useState } from "react";
import { Splash } from "@/components/gswing/Splash";
import { PremiumAuth } from "@/components/gswing/auth/PremiumAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dashboard } from "@/components/gswing/Dashboard";
import { GpsMap } from "@/components/gswing/GpsMap";
import { GpsErrorBoundary } from "@/components/gswing/GpsErrorBoundary";
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
import { MembershipGate } from "@/components/gswing/membership/MembershipGate";

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
  const [stage, setStage] = useState<"splash" | "auth" | "app">("splash");
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [view, setView] = useState("home");
  const [prevView, setPrevView] = useState<string>("home");

  const navigate = (next: string) => {
    setView((current) => {
      if (current !== next) setPrevView(current);
      return next;
    });
  };

  const goBack = () => {
    const target = prevView && prevView !== "scorecard" ? prevView : "home";
    setView(target);
  };

  // Track auth session.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Listen for the in-map "back" button dispatched by the GPS chrome.
  // MUST be declared before any conditional return to respect Rules of Hooks.
  useEffect(() => {
    const handler = () => navigate("home");
    window.addEventListener("gswing-exit-gps", handler);
    return () => window.removeEventListener("gswing-exit-gps", handler);
  }, []);

  function handleEnter() {
    if (hasSession) setStage("app");
    else setStage("auth");
  }

  // If a session appears while on auth, advance to app.
  useEffect(() => {
    if (stage === "auth" && hasSession) setStage("app");
  }, [stage, hasSession]);

  if (stage === "splash") return <Splash onEnter={handleEnter} />;
  if (stage === "auth") {
    return (
      <PremiumAuth
        onAuthenticated={() => setStage("app")}
        onBack={() => setStage("splash")}
      />
    );
  }

  const showBack = !NAV.some((n) => n.id === view) || view === "scorecard";
  const isGps = view === "gps";

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background">
      {!isGps && (
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gold/15 bg-background/85 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              onClick={goBack}
              aria-label="Back"
              className="-ml-2 inline-flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-full px-2 text-gold transition-colors hover:bg-gold/10 active:bg-gold/15"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
          )}
          <h1 className="font-serif text-lg text-gradient-gold">{TITLES[view] ?? "G Swing"}</h1>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">LinkMe</span>
      </header>
      )}

      <main className={isGps ? "px-0 py-0" : "px-4 py-4"}>
        {view === "home" && <Dashboard go={navigate} />}
        {view === "gps" && (
          <MembershipGate featureKey="gps.full">
            <GpsErrorBoundary>
              <GpsMap />
            </GpsErrorBoundary>
          </MembershipGate>
        )}
        {view === "bag" && <MyBag go={navigate} />}
        {view === "swing" && (
          <MembershipGate featureKey="swing.analysis"><SwingAnalysis /></MembershipGate>
        )}
        {view === "scorecard" && <Scorecard />}
        {view === "pros" && <ProsBags />}
        {view === "news" && <News />}
        {view === "stats" && (
          <MembershipGate featureKey="stats.advanced"><Stats /></MembershipGate>
        )}
        {view === "profile" && <Profile />}
        {view === "clublink" && <ClubLink />}
        {view === "arena" && (
          <MembershipGate featureKey="arena.full"><Arena go={navigate} /></MembershipGate>
        )}
        {view === "live" && (
          <MembershipGate featureKey="live.dashboard"><LiveDashboard go={navigate} /></MembershipGate>
        )}
        {view === "chat" && <RoundChat />}
        {view === "roast" && (
          <MembershipGate featureKey="roast.full"><Roast /></MembershipGate>
        )}
        {view === "memories" && (
          <MembershipGate featureKey="memories.full"><FairwayMemories /></MembershipGate>
        )}
        {view === "tournament" && (
          <MembershipGate featureKey="tournament.create"><Tournaments /></MembershipGate>
        )}
      </main>

      <AceCaddie />

      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-gold/20 bg-background/90 backdrop-blur-md">
        <div className="grid grid-cols-6 px-2 py-2">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => navigate(n.id)}
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
