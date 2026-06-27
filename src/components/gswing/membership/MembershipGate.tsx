import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGswingMembership } from "@/hooks/useGswingMembership";

export function MembershipGate({
  featureKey,
  children,
  onUpgrade,
}: {
  featureKey: string;
  children: React.ReactNode;
  onUpgrade?: () => void;
}) {
  const { canAccess, loading } = useGswingMembership();
  if (loading) return null;
  if (canAccess(featureKey)) return <>{children}</>;
  return (
    <div className="rounded-2xl border border-gold/30 bg-black/60 p-6 text-center backdrop-blur-md">
      <Lock className="mx-auto h-6 w-6 text-gold" />
      <p className="mt-2 font-serif text-base text-gold">Premium feature</p>
      <p className="mt-1 text-xs text-white/70">
        Upgrade to unlock premium G-Swing intelligence.
      </p>
      {onUpgrade && (
        <Button onClick={onUpgrade} className="mt-3 bg-gold text-black hover:bg-gold/90">
          Upgrade
        </Button>
      )}
    </div>
  );
}