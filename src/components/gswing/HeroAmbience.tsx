/**
 * HeroAmbience — Living environment layer for the G-Swing hero.
 * Pure CSS / SVG, no JS animation, mounted once.
 */
export const HeroAmbience = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    {/* Sun glow */}
    <div
      className="amb-sun absolute right-[-50px] top-[-50px] h-44 w-44 rounded-full"
      style={{
        background:
          "radial-gradient(circle, #D4AF37 0%, rgba(212,175,55,0.45) 35%, transparent 70%)",
      }}
    />

    {/* Slow clouds */}
    <svg className="amb-cloud absolute left-0 top-6 h-10 w-40 opacity-25" viewBox="0 0 160 40">
      <ellipse cx="40" cy="22" rx="38" ry="10" fill="#F8F8F8" />
      <ellipse cx="90" cy="18" rx="32" ry="9" fill="#F8F8F8" />
    </svg>
    <svg className="amb-cloud-2 absolute left-0 top-16 h-8 w-32 opacity-20" viewBox="0 0 160 40">
      <ellipse cx="50" cy="20" rx="48" ry="11" fill="#F8F8F8" />
    </svg>

    {/* Birds */}
    <svg className="amb-bird absolute left-0 top-10 h-3 w-6 opacity-50" viewBox="0 0 24 10">
      <path d="M1 6 Q5 1 10 5 Q15 1 23 6" stroke="#F8F8F8" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
    <svg
      className="amb-bird absolute left-0 top-20 h-2.5 w-5 opacity-40"
      style={{ animationDelay: "8s" }}
      viewBox="0 0 24 10"
    >
      <path d="M1 6 Q5 1 10 5 Q15 1 23 6" stroke="#F8F8F8" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>

    {/* Course-line silhouette */}
    <svg
      viewBox="0 0 400 220"
      preserveAspectRatio="none"
      className="absolute inset-x-0 bottom-0 h-44 w-full opacity-25"
    >
      <defs>
        <linearGradient id="fwyV2" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#146B45" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#0F3D2E" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,200 C80,150 160,170 220,140 C290,105 340,120 400,90 L400,220 L0,220 Z"
        fill="url(#fwyV2)"
      />
      <path
        d="M0,210 C90,180 180,190 260,160 C330,135 370,150 400,135"
        stroke="#D4AF37"
        strokeOpacity="0.35"
        strokeWidth="1"
        fill="none"
      />
    </svg>

    {/* Grass shimmer at base */}
    <div className="amb-grass absolute inset-x-0 bottom-0 h-6"
      style={{
        background:
          "linear-gradient(180deg, transparent, hsl(150 60% 18% / 0.55))",
      }}
    />

    {/* Pollen particles */}
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <span
        key={i}
        className="absolute block h-1 w-1 rounded-full bg-gold/70"
        style={{
          left: `${10 + i * 14}%`,
          bottom: `${5 + (i % 3) * 12}%`,
          animation: `amb-pollen ${9 + i * 1.5}s ease-in-out ${i * 1.4}s infinite`,
        }}
      />
    ))}

    {/* Flag silhouette */}
    <div className="absolute bottom-8 right-7 opacity-60">
      <div className="relative">
        <div className="absolute bottom-0 left-3 h-24 w-px bg-gradient-to-t from-gold/70 to-transparent" />
        <svg className="hero-flag h-5 w-6 text-gold" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 2v2h12l-2 4 2 4H4V2z" />
        </svg>
      </div>
    </div>
  </div>
);