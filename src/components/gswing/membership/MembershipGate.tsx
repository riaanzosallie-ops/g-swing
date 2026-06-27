import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGswingMembership } from "@/hooks/useGswingMembership";

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
  return (
    <div className="mx-auto my-6 max-w-sm rounded-2xl border border-gold/30 bg-black/70 p-6 text-center backdrop-blur-md">
      <Lock className="mx-auto h-6 w-6 text-gold" />
      <p className="mt-2 font-serif text-base text-gold">
        {title ?? `${tierLabel} feature`}
      </p>
      <p className="mt-1 text-xs text-white/70">
        {description ??
          `Upgrade to G-Swing ${tierLabel} to unlock this experience.`}
      </p>
      <p className="mt-2 text-[10px] uppercase tracking-widest text-white/40">
        Current plan: {planCode}
        {status !== "active" && planCode !== "free" ? ` · ${status}` : ""}
      </p>
      <Button
        onClick={goUpgrade}
        className="mt-3 bg-gold text-black hover:bg-gold/90"
      >
        Upgrade to {tierLabel}
      </Button>
    </div>
  );
}