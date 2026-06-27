import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GswingPlanCode = "free" | "premium" | "elite" | "platform_owner";
export type GswingStatus =
  | "pending"
  | "active"
  | "past_due"
  | "cancelled"
  | "suspended"
  | "expired";

export interface GswingMembership {
  user_id: string;
  plan_code: GswingPlanCode;
  status: GswingStatus;
  billing_cycle: string;
  source: string;
  current_period_end: string | null;
  is_owner: boolean;
}

const TIER_RANK: Record<GswingPlanCode, number> = {
  free: 10,
  premium: 50,
  elite: 90,
  platform_owner: 999,
};

// Feature → minimum plan required.
const FEATURE_MIN: Record<string, GswingPlanCode> = {
  "gps.full": "premium",
  "gps.hazards": "premium",
  "gps.weather": "premium",
  "ai.caddie": "premium",
  "shots.tracking": "premium",
  "stats.advanced": "premium",
  "swing.analysis": "premium",
  "memories.full": "premium",
  "arena.full": "premium",
  "live.dashboard": "premium",
  "roast.full": "premium",
  "tournament.create": "elite",
  "tournament.broadcast": "elite",
  "tournament.livetv": "elite",
  "tournament.awards": "elite",
  "tournament.poster": "elite",
  "course.mapper": "elite",
  "admin.membership_manager": "platform_owner",
};

export function useGswingMembership() {
  const [membership, setMembership] = useState<GswingMembership | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMembership = useCallback(async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setMembership(null);
        return;
      }
      const { data, error } = await supabase.rpc("get_effective_gswing_membership", {
        _user_id: uid,
      });
      if (error || !data || data.length === 0) {
        setMembership(null);
      } else {
        setMembership(data[0] as GswingMembership);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMembership();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshMembership();
    });
    const onFocus = () => void refreshMembership();
    window.addEventListener("focus", onFocus);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshMembership]);

  const planCode = (membership?.plan_code ?? "free") as GswingPlanCode;
  const status = membership?.status ?? "pending";
  const isOwner = !!membership?.is_owner || planCode === "platform_owner";
  const isPremium = isOwner || TIER_RANK[planCode] >= TIER_RANK.premium;
  const isElite = isOwner || TIER_RANK[planCode] >= TIER_RANK.elite;

  const canAccess = useCallback(
    (featureKey: string) => {
      if (isOwner) return true;
      if (status !== "active") return false;
      const required = FEATURE_MIN[featureKey] ?? "free";
      return TIER_RANK[planCode] >= TIER_RANK[required];
    },
    [isOwner, status, planCode],
  );

  return useMemo(
    () => ({
      membership,
      planCode,
      status,
      userId,
      isOwner,
      isPremium,
      isElite,
      canAccess,
      refreshMembership,
      loading,
    }),
    [membership, planCode, status, userId, isOwner, isPremium, isElite, canAccess, refreshMembership, loading],
  );
}