import { Check, Crown, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGswingMembership } from "@/hooks/useGswingMembership";

const PREMIUM_BENEFITS = [
  "Full Premium GPS + Hazard Intelligence",
  "AI Caddie ACE with voice",
  "Live weather + shot tracking",
  "Advanced stats and round insights",
];

const ELITE_BENEFITS = [
  "Everything in Premium",
  "Tournament Broadcast Center + Live TV",
  "Awards Ceremony + Results Posters",
  "Course Mapper + early access drops",
];

export function MembershipGate({
  featureKey,
  children,
  onUpgrade,
  title,
  description,
}: {
  featureKey: string;
  children: React.ReactNode;
  onUpgrade?: () => void;
  title?: string;
  description?: string;
}) {
  const { canAccess, loading, planCode, status } = useGswingMembership();
  if (loading) return null;
  if (canAccess(featureKey)) return <>{children}</>;
  const goUpgrade =
    onUpgrade ??
    (() => {
      window.location.href = "/auth";
    });
  const needsElite = featureKey.startsWith("tournament.") || featureKey === "course.mapper";
  const tierLabel = needsElite ? "Elite" : "Premium";
  const currentPlan = (planCode ?? "free").toLowerCase();
  return (
    <div className="relative mx-auto my-6 w-full max-w-sm overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-b from-black/85 via-black/75 to-emerald-950/60 p-5 text-center shadow-elegant backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 -top-12 h-32 bg-gold/15 blur-3xl" />
      <div className="relative">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-gold/50 bg-black/60 shadow-[0_0_24px_rgba(245,200,75,0.35)]">
          <Lock className="h-4 w-4 text-gold" />
        </div>
        <p className="mt-2 font-serif text-lg text-gold">
          {title ?? `${tierLabel} feature`}
        </p>
        <p className="mt-1 text-xs text-white/70">
          {description ??
            `Upgrade to G-Swing ${tierLabel} to unlock this experience.`}
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/45">
          Current plan: {planCode}
          {status !== "active" && currentPlan !== "free" ? ` · ${status}` : ""}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-left">
          <BenefitColumn
            label="Premium"
            highlight={!needsElite}
            current={currentPlan === "premium"}
            benefits={PREMIUM_BENEFITS}
            icon={<Sparkles className="h-3.5 w-3.5" />}
          />
          <BenefitColumn
            label="Elite"
            highlight={needsElite}
            current={currentPlan === "elite"}
            benefits={ELITE_BENEFITS}
            icon={<Crown className="h-3.5 w-3.5" />}
          />
        </div>

        <Button
          onClick={goUpgrade}
          className="group mt-4 h-10 w-full rounded-full bg-gradient-to-r from-amber-300 via-gold to-amber-400 text-sm font-semibold uppercase tracking-wider text-black shadow-[0_0_24px_rgba(245,200,75,0.45)] transition-transform hover:scale-[1.02] hover:from-gold hover:to-gold"
        >
          Upgrade to {tierLabel}
        </Button>
        <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
          One tap · Ziina secure checkout
        </p>
      </div>
    </div>
  );
}

function BenefitColumn({
  label,
  highlight,
  current,
  benefits,
  icon,
}: {
  label: string;
  highlight: boolean;
  current: boolean;
  benefits: string[];
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-2.5 text-[10px] leading-snug ${
        highlight
          ? "border-gold/55 bg-gold/10 text-white"
          : "border-white/10 bg-black/40 text-white/70"
      } ${current ? "ring-1 ring-emerald-400/60" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 font-semibold uppercase tracking-[0.18em] text-gold">
          {icon}
          {label}
        </div>
        {current && (
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-emerald-200">
            Current
          </span>
        )}
      </div>
      <ul className="mt-2 space-y-1">
        {benefits.map((b) => (
          <li key={b} className="flex items-start gap-1">
            <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-gold" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}