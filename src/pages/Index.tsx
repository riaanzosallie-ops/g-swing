import { useEffect, useState } from "react";
import { Splash } from "@/components/gswing/Splash";
import { PremiumAuth } from "@/components/gswing/auth/PremiumAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dashboard } from "@/components/gswing/Dashboard";
import { GpsMap } from "@/components/gswing/GpsMap";
import { GpsErrorBoundary } from "@/components/gswing/GpsErrorBoundary";
import { AppErrorBoundary } from "@/components/gswing/AppErrorBoundary";
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
import ManageCourses from "@/components/gswing/admin/ManageCourses";
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
  memories: "Fairway Memories", tournament: "Tournaments", courses: "Manage Courses",
};

const Index = () => {
  const [stage, setStage] = useState<"splash" | "auth" | "app">("splash");
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [pendingEnter, setPendingEnter] = useState(false);
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

  // Premium GPS dock buttons (Scorecard / Settings) bridge through here.
  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (typeof next === "string" && next) navigate(next);
    };
    window.addEventListener("gswing-nav", handler as EventListener);
    return () => window.removeEventListener("gswing-nav", handler as EventListener);
  }, []);

  // Deep link: /?view=<id> jumps straight to that section (used by the
  // Course Mapper return path so a saved hole hops straight back to
  // Live GPS). Leaves `refreshMap` and `hole` params on the URL for
  // GpsMap to consume, but strips `view` once applied.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const target = url.searchParams.get("view");
    if (!target) return;
    if (hasSession === false) return; // wait until session decision
    setStage("app");
    setView(target);
    url.searchParams.delete("view");
    window.history.replaceState(
      {},
      "",
      url.pathname + (url.search || "") + url.hash,
    );
  }, [hasSession]);

  function handleEnter() {
    // Session lookup may still be in flight; wait rather than
    // forcing the user to re-login.
    if (hasSession === null) {
      setPendingEnter(true);
      return;
    }
    if (hasSession) setStage("app");
    else setStage("auth");
  }

  // If a session appears while on auth, advance to app.
  useEffect(() => {
    if (stage === "auth" && hasSession) setStage("app");
  }, [stage, hasSession]);

  // Resolve a pending Enter tap once the session decision arrives.
  useEffect(() => {
    if (!pendingEnter || hasSession === null) return;
    setPendingEnter(false);
    setStage(hasSession ? "app" : "auth");
  }, [pendingEnter, hasSession]);

  if (stage === "splash") return <Splash onEnter={handleEnter} />;
  if (stage === "auth") {
    // Only show login once we've confirmed there is no session.
    if (hasSession === null) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        </div>
      );
    }
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
        {view === "bag" && (
          <AppErrorBoundary label="My Bag"><MyBag go={navigate} /></AppErrorBoundary>
        )}
        {view === "swing" && (
          <MembershipGate featureKey="swing.analysis">
            <AppErrorBoundary label="Swing Analysis"><SwingAnalysis /></AppErrorBoundary>
          </MembershipGate>
        )}
        {view === "scorecard" && (
          <AppErrorBoundary label="Scorecard"><Scorecard /></AppErrorBoundary>
        )}
        {view === "pros" && <AppErrorBoundary label="Pros' Bags"><ProsBags /></AppErrorBoundary>}
        {view === "news" && <AppErrorBoundary label="News"><News /></AppErrorBoundary>}
        {view === "stats" && (
          <MembershipGate featureKey="stats.advanced">
            <AppErrorBoundary label="Stats"><Stats /></AppErrorBoundary>
          </MembershipGate>
        )}
        {view === "profile" && <AppErrorBoundary label="Profile"><Profile /></AppErrorBoundary>}
        {view === "clublink" && <AppErrorBoundary label="Club-Link"><ClubLink /></AppErrorBoundary>}
        {view === "arena" && (
          <MembershipGate featureKey="arena.full">
            <AppErrorBoundary label="Arena"><Arena go={navigate} /></AppErrorBoundary>
          </MembershipGate>
        )}
        {view === "live" && (
          <MembershipGate featureKey="live.dashboard">
            <AppErrorBoundary label="Live Dashboard"><LiveDashboard go={navigate} /></AppErrorBoundary>
          </MembershipGate>
        )}
        {view === "chat" && <AppErrorBoundary label="Round Chat"><RoundChat /></AppErrorBoundary>}
        {view === "roast" && (
          <MembershipGate featureKey="roast.full">
            <AppErrorBoundary label="ACE Roast"><Roast /></AppErrorBoundary>
          </MembershipGate>
        )}
        {view === "memories" && (
          <MembershipGate featureKey="memories.full">
            <AppErrorBoundary label="Fairway Memories"><FairwayMemories /></AppErrorBoundary>
          </MembershipGate>
        )}
        {view === "tournament" && (
          <MembershipGate featureKey="tournament.create">
            <AppErrorBoundary label="Tournaments"><Tournaments /></AppErrorBoundary>
          </MembershipGate>
        )}
        {view === "courses" && (
          <AppErrorBoundary label="Manage Courses"><ManageCourses go={navigate} /></AppErrorBoundary>
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
