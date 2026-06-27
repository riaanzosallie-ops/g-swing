// G-Swing admin gate. Reads the current session and checks user_roles for
// any of: owner | platform_owner | admin. No secrets, no env config.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GswingAdminState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "denied"; userId: string }
  | { status: "admin"; userId: string };

export function useGswingAdmin(): GswingAdminState {
  const [state, setState] = useState<GswingAdminState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;
      if (!user) {
        if (!cancelled) setState({ status: "anon" });
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["owner", "platform_owner", "admin"]);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setState({ status: "denied", userId: user.id });
      } else {
        setState({ status: "admin", userId: user.id });
      }
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}