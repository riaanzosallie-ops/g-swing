import {
  Shield, MapPin, Bot, Target, Trophy, Crown, ArrowRight,
  Activity, Locate, Briefcase, Video, Newspaper, Film,
  Swords, MessagesSquare, Shirt, Coins,
} from "lucide-react";
import { usePlayer, useRounds } from "@/lib/gswing-store";
import courseBg from "@/assets/course-bg.jpg";

/* ── GPS location marker ─────────────────────────────────────────── */
const GpsMarker = ({
  name, dist, style,
}: { name: string; dist: string; style: React.CSSProperties }) => (
  <div className="absolute z-20" style={style}>
    <div className="flex items-center gap-1.5">
      <div className="relative flex-shrink-0">
        <div className="h-2 w-2 rounded-full" style={{ background: '#D4AF37' }} />
        <div className="absolute inset-0 rounded-full animate-ping-slow" style={{ background: '#D4AF37' }} />
      </div>
      <div>
        <p className="text-[11px] font-semibold leading-tight text-white/90">{name}</p>
        <p className="text-[9px]" style={{ color: 'rgba(212,175,55,0.8)' }}>{dist}</p>
      </div>
    </div>
  </div>
);

/* ── Feature card ────────────────────────────────────────────────── */
const FeatureCard = ({
  icon: Icon, title, desc, onClick,
}: { icon: React.ElementType; title: string; desc: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group relative flex flex-col gap-3 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
    style={{
      background: 'rgba(12,12,12,0.92)',
      border: '1px solid rgba(255,255,255,0.055)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
    }}>
    <div
      className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <Icon className="h-5 w-5" style={{ color: '#D4AF37' }} />
    </div>
    <div>
      <p className="text-[11px] font-black tracking-wider text-white uppercase">{title}</p>
      <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.32)' }}>{desc}</p>
    </div>
    {/* Gold underline accent */}
    <div
      className="absolute bottom-3 left-4 h-[1.5px] w-7 rounded-full"
      style={{ background: 'rgba(212,175,55,0.5)' }}
    />
  </button>
);

/* ── Quick-access tile ───────────────────────────────────────────── */
const QuickTile = ({ icon: Icon, label, onClick }: {
  icon: React.ElementType; label: string; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1.5 rounded-xl py-3 transition-all active:scale-95"
    style={{ background: 'rgba(13,13,13,0.8)', border: '1px solid rgba(255,255,255,0.04)' }}>
    <Icon className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.28)' }} />
    <span className="text-[9px] tracking-wide" style={{ color: 'rgba(255,255,255,0.22)' }}>{label}</span>
  </button>
);

/* ── Dashboard ───────────────────────────────────────────────────── */
export const Dashboard = ({
  go,
  openAce,
}: { go: (id: string) => void; openAce?: () => void }) => {
  const [player] = usePlayer();
  const [rounds] = useRounds();

  const avgScore = rounds.length
    ? (rounds.reduce((s, r) => s + r.score, 0) / rounds.length).toFixed(1)
    : "—";
  const totalHoles = rounds.reduce((s, r) => s + r.holes, 0);

  return (
    <div className="-mx-4 overflow-x-hidden pb-24">

      {/* ═══════════════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ minHeight: '86vh' }}>

        {/* Background landscape */}
        <img
          src={courseBg} alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.1, transform: 'scale(1.1)' }}
        />

        {/* Gradient overlays */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(5,5,5,0.55) 0%, transparent 25%, rgba(5,5,5,0.65) 72%, #050505 100%)',
        }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% -15%, rgba(212,175,55,0.09) 0%, transparent 65%)',
        }} />

        {/* ── Brand header ── */}
        <div className="relative z-20 flex items-center justify-between px-5 pt-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.22)' }}>
              <Shield className="h-4 w-4" style={{ color: '#D4AF37' }} />
            </div>
            <div>
              <p className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: '#D4AF37' }}>
                Premium Golf OS
              </p>
              <p className="text-[8px] tracking-[0.18em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Live. Play. Improve.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'rgba(212,175,55,0.6)' }}>
              LinkMe
            </span>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl"
              style={{ background: '#0a0a0a', border: '1px solid rgba(212,175,55,0.22)', boxShadow: '0 0 20px rgba(212,175,55,0.18)' }}>
              <span className="font-serif text-xl font-black text-gradient-gold">G</span>
            </div>
          </div>
        </div>

        {/* ── Hero text ── */}
        <div className="relative z-20 px-5 pt-5 text-center">
          <p className="text-[10px] tracking-[0.32em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Welcome to
          </p>
          <h1
            className="mt-0.5 font-serif font-black leading-none"
            style={{
              fontSize: '72px',
              backgroundImage: 'linear-gradient(160deg, #F5E17A 0%, #D4AF37 28%, #9A7A0A 58%, #E8C84A 80%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 55px rgba(212,175,55,0.75))',
            }}>
            G Swing
          </h1>
          <p className="mt-1.5 text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>
            The ultimate golf companion
          </p>
          <p className="text-[10px] tracking-[0.2em] font-semibold uppercase" style={{ color: '#D4AF37' }}>
            Built for serious players.
          </p>
        </div>

        {/* ── GPS Markers ── */}
        <GpsMarker name="Dubai"       dist="7.2 km"  style={{ top: '40%', left: '4%'  }} />
        <GpsMarker name="Augusta"     dist="9.6 km"  style={{ top: '25%', right: '7%' }} />
        <GpsMarker name="St Andrews"  dist="11.3 km" style={{ top: '52%', right: '3%' }} />
        <GpsMarker name="Pebble Beach" dist="13.8 km" style={{ top: '67%', right: '6%' }} />

        {/* ── G Logo Centerpiece ── */}
        <div className="relative z-10 flex flex-col items-center mt-2">
          <div
            className="relative"
            style={{ animation: 'float 5s ease-in-out infinite' }}>

            {/* Ambient glow aura */}
            <div className="absolute inset-0 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.55), transparent 68%)', opacity: 0.55 }} />

            {/* The G — metallic gradient text */}
            <div
              className="relative select-none"
              style={{
                fontSize: '210px',
                lineHeight: 1,
                fontFamily: "'Georgia', 'Playfair Display', serif",
                fontWeight: 900,
                backgroundImage: 'linear-gradient(160deg, #F5E17A 0%, #D4AF37 22%, #8B6914 52%, #E8C84A 76%, #9A7A0A 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 65px rgba(212,175,55,0.95)) drop-shadow(0 18px 45px rgba(0,0,0,0.95))',
              }}>
              G

              {/* Golf ball — sits in the opening of the G */}
              <div
                className="absolute overflow-hidden rounded-full"
                style={{
                  top: '35%', right: '6%',
                  width: '75px', height: '75px',
                  background: 'radial-gradient(circle at 32% 28%, #ffffff, #eaeaea 62%, #c0c0c0)',
                  boxShadow: '0 0 32px rgba(255,255,255,0.75), inset 0 -8px 18px rgba(0,0,0,0.22)',
                }}>
                {/* Dimple texture */}
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle, rgba(110,110,110,0.28) 1.5px, transparent 1.5px)',
                  backgroundSize: '9px 9px',
                  backgroundPosition: '4px 4px',
                }} />
                {/* Specular highlight */}
                <div className="absolute rounded-full bg-white/82"
                  style={{ top: '8px', left: '10px', width: '22px', height: '15px', filter: 'blur(4px)' }} />
              </div>
            </div>
          </div>

          {/* Podium base */}
          <div className="flex flex-col items-center -mt-10 relative z-10">
            <div className="h-3 w-44 rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6), rgba(212,175,55,0.4), rgba(212,175,55,0.6), transparent)' }} />
            <div className="mt-0.5 h-2 w-32 rounded-b-full"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent)' }} />
            {/* Reflection glow */}
            <div className="-mt-6 h-16 w-60 blur-2xl"
              style={{ background: 'radial-gradient(ellipse, rgba(212,175,55,0.42), transparent 70%)', opacity: 0.65 }} />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          LIVE STATS BAR
      ═══════════════════════════════════════════════════ */}
      <section className="relative z-20 mx-4 -mt-6">
        <div
          className="rounded-2xl px-1 py-3"
          style={{
            background: 'rgba(10,10,10,0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.75)',
          }}>
          <div className="grid grid-cols-3">
            {/* GPS */}
            <div className="flex flex-col items-center gap-0.5 border-r py-1" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <Locate className="mb-0.5 h-4 w-4" style={{ color: '#D4AF37' }} />
              <p className="text-[8px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.28)' }}>Live GPS</p>
              <p className="text-[11px] font-bold tracking-wider" style={{ color: '#D4AF37' }}>Connected</p>
            </div>
            {/* Holes */}
            <div className="flex flex-col items-center gap-0.5 border-r py-1" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <Target className="mb-0.5 h-4 w-4" style={{ color: '#D4AF37' }} />
              <p className="text-[8px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.28)' }}>Holes Played</p>
              <p className="text-2xl font-black leading-none text-white">{totalHoles}</p>
              <p className="text-[8px]" style={{ color: 'rgba(255,255,255,0.22)' }}>This Month</p>
            </div>
            {/* Score */}
            <div className="flex flex-col items-center gap-0.5 py-1">
              <Activity className="mb-0.5 h-4 w-4" style={{ color: '#D4AF37' }} />
              <p className="text-[8px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.28)' }}>Avg Score</p>
              <p className="text-2xl font-black leading-none text-white">{avgScore}</p>
              <p className="text-[8px]" style={{ color: '#D4AF37' }}>-1.8</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          ENTER G SWING — PRIMARY CTA
      ═══════════════════════════════════════════════════ */}
      <section className="mx-4 mt-3">
        <button
          onClick={() => go("gps")}
          className="group relative w-full overflow-hidden rounded-2xl py-[15px] text-[13px] font-black tracking-[0.24em] text-black uppercase"
          style={{
            background: 'linear-gradient(135deg, #F5E17A 0%, #D4AF37 40%, #B8960C 72%, #E8C84A 100%)',
            boxShadow: '0 10px 42px -8px rgba(212,175,55,0.72)',
          }}>
          {/* Shimmer sweep on hover */}
          <div className="absolute inset-0 w-[28%] -translate-x-full skew-x-[-18deg] bg-white/22 group-hover:translate-x-[500%] transition-transform duration-[660ms]" />
          <span className="relative flex items-center justify-center gap-3">
            Enter G Swing <ArrowRight className="h-[14px] w-[14px]" />
          </span>
        </button>
      </section>

      {/* ═══════════════════════════════════════════════════
          FEATURE CARDS
      ═══════════════════════════════════════════════════ */}
      <section className="mx-4 mt-5">
        <div className="grid grid-cols-2 gap-3">
          <FeatureCard icon={MapPin}  title="Live GPS"    desc="Accurate yardages for every shot."            onClick={() => go("gps")}       />
          <FeatureCard icon={Bot}     title="ACE Caddie"  desc="AI powered caddie for smarter decisions."     onClick={() => openAce?.()}     />
          <FeatureCard icon={Target}  title="Score"       desc="Track, analyze and improve your game."        onClick={() => go("scorecard")} />
          <FeatureCard icon={Trophy}  title="Tournaments" desc="Compete in premium global events."            onClick={() => go("arena")}     />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          PREMIUM MEMBERSHIP CARD
      ═══════════════════════════════════════════════════ */}
      <section className="mx-4 mt-4">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ background: 'rgba(8,8,8,0.96)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 60px rgba(0,0,0,0.75)' }}>
          <div className="flex items-center">
            {/* Left: visual */}
            <div className="relative h-[112px] w-[115px] flex-shrink-0 overflow-hidden">
              <img
                src={courseBg} alt="Premium clubs"
                className="h-full w-full object-cover"
                style={{ filter: 'saturate(0.15) brightness(0.45)', transform: 'scale(1.25)' }}
              />
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(8,8,8,0.96) 100%)' }} />
            </div>
            {/* Right: text */}
            <div className="flex-1 py-4 pr-4">
              <div className="mb-1 flex items-center gap-1.5">
                <Crown className="h-3 w-3" style={{ color: '#D4AF37' }} />
                <p className="text-[8px] font-bold tracking-[0.22em] uppercase" style={{ color: '#D4AF37' }}>
                  G Swing Premium
                </p>
              </div>
              <h3 className="font-serif text-[17px] font-black leading-tight text-white">Elevate Your Game</h3>
              <p className="mt-1 text-[9px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.33)' }}>
                Unlock advanced analytics, premium insights and exclusive benefits.
              </p>
              <button
                onClick={() => go("profile")}
                className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase"
                style={{ color: '#D4AF37' }}>
                Upgrade Now <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.38), transparent)' }} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          CLUB-LINK EARN CARD
      ═══════════════════════════════════════════════════ */}
      <section className="mx-4 mt-4">
        <div
          className="rounded-2xl p-4"
          style={{ background: 'rgba(12,12,12,0.9)', border: '1px solid rgba(212,175,55,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, #F5E17A 0%, #D4AF37 40%, #8B6914 100%)' }}>
              <Coins className="h-5 w-5 text-black" />
            </div>
            <div className="flex-1">
              <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(212,175,55,0.75)' }}>Earn from your clubs</p>
              <h3 className="font-serif text-[15px] font-black leading-tight text-white">Become a Linker on Club-Link</h3>
              <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.32)' }}>
                List your bag for rental when you're not playing. Verified Linkers earn AED 200–800/week.
              </p>
              <button
                onClick={() => go("clublink")}
                className="mt-3 rounded-xl px-4 py-2 text-[11px] font-black tracking-wider uppercase text-black"
                style={{ background: 'linear-gradient(135deg, #F5E17A 0%, #D4AF37 50%, #8B6914 100%)' }}>
                Open Club-Link →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          QUICK ACCESS GRID
      ═══════════════════════════════════════════════════ */}
      <section className="mx-4 mt-5">
        <p className="mb-3 text-[8px] tracking-[0.35em] uppercase" style={{ color: 'rgba(255,255,255,0.18)' }}>
          Quick Access
        </p>
        <div className="grid grid-cols-4 gap-2">
          <QuickTile icon={Briefcase}    label="My Bag"    onClick={() => go("bag")}       />
          <QuickTile icon={Video}        label="Swing"     onClick={() => go("swing")}     />
          <QuickTile icon={Newspaper}    label="News"      onClick={() => go("news")}      />
          <QuickTile icon={Film}         label="Memories"  onClick={() => go("memories")}  />
          <QuickTile icon={Trophy}       label="Pros' Bags" onClick={() => go("pros")}     />
          <QuickTile icon={Swords}       label="Arena"     onClick={() => go("arena")}     />
          <QuickTile icon={MessagesSquare} label="Chat"   onClick={() => go("chat")}       />
          <QuickTile icon={Shirt}        label="Golf Fit"  onClick={() => go("profile")}   />
        </div>
      </section>
    </div>
  );
};
