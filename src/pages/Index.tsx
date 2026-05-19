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
import { Home, Map, CircleDot, BarChart3, User, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "home",      label: "Home",    icon: Home      },
  { id: "gps",       label: "Courses", icon: Map       },
  { id: "scorecard", label: "Play",    icon: CircleDot },
  { id: "stats",     label: "Stats",   icon: BarChart3 },
  { id: "profile",   label: "Profile", icon: User      },
];

const TITLES: Record<string, string> = {
  home: "G Swing", gps: "Live GPS", bag: "My Bag", scorecard: "Scorecard",
  swing: "Swing Analysis", pros: "Pros' Bags", news: "Tour News",
  stats: "Performance", profile: "Profile", clublink: "Club-Link",
  arena: "Betting Arena", live: "Live Dashboard", chat: "Round Chat",
  roast: "ACE Roast", memories: "Fairway Memories",
};

const Index = () => {
  const [splashGone, setSplashGone] = useState(false);
  const [view, setView] = useState("home");

  if (!splashGone) return <Splash onEnter={() => setSplashGone(true)} />;

  const isHome   = view === "home";
  const isNavTab = NAV.some((n) => n.id === view);
  const showBack = !isNavTab;

  const openAce = () => window.dispatchEvent(new Event("gswing:openAce"));

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background">

      {/* Header — hidden on home (Dashboard has its own) */}
      {!isHome && (
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 backdrop-blur-md"
          style={{
            background: 'rgba(5,5,5,0.9)',
            borderBottom: '1px solid rgba(212,175,55,0.1)',
          }}>
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                onClick={() => setView("home")}
                className="-ml-2 rounded-full p-1"
                style={{ color: '#D4AF37' }}>
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <h1
              className="font-serif text-lg font-black"
              style={{
                backgroundImage: 'linear-gradient(135deg, #F5E17A, #D4AF37, #9A7A0A)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
              {TITLES[view] ?? "G Swing"}
            </h1>
          </div>
          <span
            className="text-[9px] font-bold tracking-[0.22em] uppercase"
            style={{ color: 'rgba(212,175,55,0.5)' }}>
            LinkMe
          </span>
        </header>
      )}

      {/* Main content */}
      <main className={isHome ? "" : "px-4 py-4"}>
        {view === "home"      && <Dashboard go={setView} openAce={openAce} />}
        {view === "gps"       && <GpsMap />}
        {view === "bag"       && <MyBag go={setView} />}
        {view === "swing"     && <SwingAnalysis />}
        {view === "scorecard" && <Scorecard />}
        {view === "pros"      && <ProsBags />}
        {view === "news"      && <News />}
        {view === "stats"     && <Stats />}
        {view === "profile"   && <Profile />}
        {view === "clublink"  && <ClubLink />}
        {view === "arena"     && <Arena go={setView} />}
        {view === "live"      && <LiveDashboard go={setView} />}
        {view === "chat"      && <RoundChat />}
        {view === "roast"     && <Roast />}
        {view === "memories"  && <FairwayMemories />}
      </main>

      <AceCaddie />

      {/* Premium bottom navigation */}
      <nav
        className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2"
        style={{
          background: 'rgba(5,5,5,0.93)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(212,175,55,0.09)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.55)',
        }}>
        <div className="grid grid-cols-5 px-2 py-2">
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[9px] font-semibold tracking-wider uppercase transition-all"
                )}>
                <div
                  className="mb-0.5 flex h-7 w-7 items-center justify-center rounded-xl transition-all"
                  style={active
                    ? { background: 'linear-gradient(135deg, #F5E17A 0%, #D4AF37 50%, #8B6914 100%)', boxShadow: '0 0 14px rgba(212,175,55,0.55)' }
                    : { background: 'transparent' }
                  }>
                  <n.icon
                    className="h-[15px] w-[15px]"
                    style={{ color: active ? '#050505' : 'rgba(255,255,255,0.22)' }}
                  />
                </div>
                <span style={{ color: active ? '#D4AF37' : 'rgba(255,255,255,0.2)' }}>
                  {n.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Index;
