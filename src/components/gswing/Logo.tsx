import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  iconOnly?: boolean;
}

/**
 * G Swing premium logo
 * - Bold "G" with swing arc wrapping around it
 * - Club head detail at end of the arc
 * - Animated rotating golf ball as the dot of the "I" in SWING
 * - Metallic gold gradient with subtle shine
 */
export const Logo = ({ size = 120, showWordmark = true, className, iconOnly = false }: LogoProps) => {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="drop-shadow-[0_8px_30px_hsl(45_80%_55%/0.45)]"
        aria-label="G Swing"
      >
        <defs>
          <linearGradient id="gs-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(48, 95%, 80%)" />
            <stop offset="35%" stopColor="hsl(45, 90%, 60%)" />
            <stop offset="55%" stopColor="hsl(38, 85%, 45%)" />
            <stop offset="80%" stopColor="hsl(45, 90%, 62%)" />
            <stop offset="100%" stopColor="hsl(40, 80%, 38%)" />
          </linearGradient>
          <linearGradient id="gs-shine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0.55" />
            <stop offset="55%" stopColor="white" stopOpacity="0.05" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="gs-bg" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="hsl(150, 45%, 14%)" />
            <stop offset="100%" stopColor="hsl(150, 40%, 5%)" />
          </radialGradient>
        </defs>

        <circle cx="100" cy="100" r="96" fill="url(#gs-bg)" stroke="url(#gs-gold)" strokeWidth="2" />

        {/* Swing arc */}
        <path
          d="M 38 70 Q 100 0 168 60"
          fill="none"
          stroke="url(#gs-gold)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Club shaft */}
        <line x1="168" y1="60" x2="178" y2="44" stroke="url(#gs-gold)" strokeWidth="4" strokeLinecap="round" />
        {/* Club head */}
        <path
          d="M 174 38 L 192 32 L 188 50 L 174 50 Z"
          fill="url(#gs-gold)"
          stroke="hsl(38, 70%, 28%)"
          strokeWidth="1"
          strokeLinejoin="round"
        />

        {/* Bold G */}
        <text
          x="100"
          y="152"
          textAnchor="middle"
          fontFamily="'Playfair Display', Georgia, serif"
          fontSize="150"
          fontWeight="800"
          fill="url(#gs-gold)"
          stroke="hsl(38, 60%, 22%)"
          strokeWidth="1.2"
        >
          G
        </text>
        <text
          x="100"
          y="152"
          textAnchor="middle"
          fontFamily="'Playfair Display', Georgia, serif"
          fontSize="150"
          fontWeight="800"
          fill="url(#gs-shine)"
          pointerEvents="none"
        >
          G
        </text>
      </svg>

      {showWordmark && !iconOnly && (
        <div
          className="mt-2 flex items-end justify-center text-foreground/95"
          style={{ fontFamily: "'Playfair Display', serif", fontSize: size * 0.22 }}
        >
          <span className="font-bold tracking-[0.32em]">SW</span>
          <span className="relative inline-flex flex-col items-center mx-[0.04em] leading-none">
            <GolfBallDot />
            <span className="font-bold tracking-[0.32em] leading-none">I</span>
          </span>
          <span className="font-bold tracking-[0.32em]">NG</span>
        </div>
      )}
    </div>
  );
};

const GolfBallDot = () => (
  <span
    className="mb-[3px] inline-block h-[0.5em] w-[0.5em] rounded-full"
    style={{
      background:
        "radial-gradient(circle at 30% 30%, #ffffff 0%, #f1f1f1 38%, #c9c9c9 72%, #888 100%)",
      boxShadow:
        "inset -1px -2px 3px rgba(0,0,0,0.35), inset 1px 1px 2px rgba(255,255,255,0.9), 0 0 6px hsl(45, 80%, 60%, 0.45)",
      animation: "ball-spin 4s linear infinite",
    }}
    aria-hidden
  />
);

export default Logo;
