import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { PlanPicker, type PlanChoice } from "@/components/gswing/membership/PlanPicker";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { OWNER_EMAIL } from "@/hooks/useGswingMembership";

const PLAN_STORAGE_KEY = "gswing.signup.plan";

type Phase = "select" | "auth" | "verify-email" | "pay" | "polling" | "blocked";

const isOwner = (e?: string | null) =>
  !!e && e.trim().toLowerCase() === OWNER_EMAIL;

function devLog(label: string, data: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info(`[gswing.pay] ${label}`, data);
  }
}

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [plan, setPlan] = useState<PlanChoice>({ code: "free", cycle: "monthly" });
  const [phase, setPhase] = useState<Phase>("select");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [paySession, setPaySession] = useState<{ id: string; url: string } | null>(null);
  const [polling, setPolling] = useState(false);

  function clearPaymentState() {
    localStorage.removeItem(PLAN_STORAGE_KEY);
    try {
      sessionStorage.removeItem("gswing.pay.session");
    } catch {
      /* ignore */
    }
    setPaySession(null);
    setPolling(false);
  }

  async function routeIfOwner(): Promise<boolean> {
    const { data } = await supabase.auth.getUser();
    const em = data?.user?.email ?? null;
    if (isOwner(em)) {
      devLog("owner-detected → bypass payment", { email: em });
      clearPaymentState();
      navigate("/", { replace: true });
      return true;
    }
    return false;
  }

  // Restore selected plan on OAuth return + resume flow.
  useEffect(() => {
    const stored = localStorage.getItem(PLAN_STORAGE_KEY);
    if (stored) {
      try {
        setPlan(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        if (isOwner(data.user.email)) {
          clearPaymentState();
          navigate("/", { replace: true });
          return;
        }
        // Already signed in: continue based on stored plan.
        const choice: PlanChoice = stored ? JSON.parse(stored) : { code: "free", cycle: "monthly" };
        if (choice.code === "free") {
          localStorage.removeItem(PLAN_STORAGE_KEY);
          navigate("/", { replace: true });
        } else {
          setPhase("pay");
        }
      }
    })();
    if (params.get("verified")) setPhase("verify-email");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistPlan(next: PlanChoice) {
    setPlan(next);
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(next));
  }

  // NOTE: Google / Apple OAuth are intentionally hidden from the UI to
  // simplify onboarding. Backend providers stay enabled — re-add the
  // buttons here to restore social login.

  async function handleEmailSignup() {
    persistPlan(plan);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/auth?verified=1" },
    });
    setBusy(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message });
      return;
    }
    setPhase("verify-email");
  }

  async function handleEmailLogin() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast({ title: "Login failed", description: error.message });
      return;
    }
    if (await routeIfOwner()) return;
    const stored = localStorage.getItem(PLAN_STORAGE_KEY);
    const choice: PlanChoice = stored ? JSON.parse(stored) : { code: "free", cycle: "monthly" };
    if (choice.code === "free") {
      localStorage.removeItem(PLAN_STORAGE_KEY);
      navigate("/", { replace: true });
    } else {
      setPhase("pay");
    }
  }

  async function launchCheckout(url: string): Promise<boolean> {
    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = url;
      return true;
    }
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win || win.closed || typeof win.closed === "undefined") {
      devLog("popup blocked", { url });
      return false;
    }
    return true;
  }

  async function startPayment() {
    // Owner safety net.
    if (await routeIfOwner()) return;
    setBusy(true);
    devLog("create-intent", { plan });
    const { data, error } = await supabase.functions.invoke("create-gswing-ziina-checkout", {
      body: {
        plan_code: plan.code,
        billing_cycle: plan.cycle,
        return_url: window.location.origin + "/auth",
      },
    });
    setBusy(false);
    devLog("create-intent:response", { error, data });
    const checkoutUrl: string | undefined = data?.checkout_url;
    const sessionId: string | undefined = data?.session_id;
    if (error || !checkoutUrl || !sessionId || !/^https?:\/\//.test(checkoutUrl)) {
      toast({
        title: "Payment unavailable",
        description: "Please try again in a moment.",
      });
      return;
    }
    const session = { id: sessionId, url: checkoutUrl };
    setPaySession(session);
    const opened = await launchCheckout(checkoutUrl);
    devLog("checkout-opened", { opened, url: checkoutUrl });
    if (!opened) {
      setPhase("blocked");
      return;
    }
    setPhase("polling");
    setPolling(true);
    devLog("polling-started", { sessionId });
  }

  async function reopenCheckout() {
    if (!paySession) return;
    const opened = await launchCheckout(paySession.url);
    if (opened) {
      setPhase("polling");
      setPolling(true);
    }
  }

  // Polling loop: every 5s, max 15 minutes.
  useEffect(() => {
    if (!polling || !paySession) return;
    let cancelled = false;
    const started = Date.now();
    const tick = async () => {
      if (cancelled) return;
      // Owner can sign in mid-flow → bypass immediately.
      const { data: u } = await supabase.auth.getUser();
      if (isOwner(u?.user?.email)) {
        clearPaymentState();
        navigate("/", { replace: true });
        return;
      }
      if (Date.now() - started > 15 * 60 * 1000) {
        setPolling(false);
        devLog("polling-timeout", { sessionId: paySession.id });
        toast({ title: "Payment timed out", description: "Please try again." });
        return;
      }
      const { data, error } = await supabase.functions.invoke("poll-gswing-ziina-payment", {
        body: { session_id: paySession.id },
      });
      if (cancelled) return;
      devLog("poll", { status: data?.status, error });
      if (error) {
        // keep polling on transient errors
      } else if (data?.status === "paid") {
        setPolling(false);
        clearPaymentState();
        // Refresh membership across the app without forcing a logout/reload.
        window.dispatchEvent(new Event("gswing-membership-refresh"));
        try {
          await supabase.auth.refreshSession();
        } catch {
          /* ignore */
        }
        devLog("membership-activated", { plan });
        toast({ title: "Welcome to G-Swing", description: "Membership activated." });
        navigate("/", { replace: true });
        return;
      } else if (data?.status && ["failed", "cancelled", "expired"].includes(data.status)) {
        setPolling(false);
        toast({ title: "Payment not completed", description: data.status });
        return;
      }
      setTimeout(tick, 5000);
    };
    void tick();
    return () => {
      cancelled = true;
      devLog("polling-stopped", { sessionId: paySession.id });
    };
  }, [polling, paySession, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-black to-black px-4 py-8 text-white">
      <div className="mx-auto max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="font-serif text-2xl text-gold">G-Swing Membership</h1>
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold-soft/80">Choose · Sign in · Play</p>
        </div>

        {phase === "select" && (
          <>
            <PlanPicker value={plan} onChange={persistPlan} />
            <Button onClick={() => setPhase("auth")} className="w-full bg-gold text-black hover:bg-gold/90">
              Continue
            </Button>
          </>
        )}

        {phase === "auth" && (
          <div className="space-y-4 rounded-2xl border border-gold/25 bg-black/60 p-4 backdrop-blur-md">
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <div className="mt-3 space-y-2">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Label className="text-xs">Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <TabsContent value="signin" className="mt-3">
                <Button disabled={busy} onClick={handleEmailLogin} className="w-full bg-gold text-black hover:bg-gold/90">
                  Sign in
                </Button>
              </TabsContent>
              <TabsContent value="signup" className="mt-3">
                <Button disabled={busy} onClick={handleEmailSignup} className="w-full bg-gold text-black hover:bg-gold/90">
                  Create account
                </Button>
              </TabsContent>
            </Tabs>
            <button
              type="button"
              onClick={() => setPhase("select")}
              className="block w-full text-center text-[11px] text-gold-soft hover:text-gold"
            >
              ← Change plan
            </button>
          </div>
        )}

        {phase === "verify-email" && (
          <div className="rounded-2xl border border-gold/25 bg-black/60 p-5 text-center backdrop-blur-md">
            <ShieldCheck className="mx-auto h-7 w-7 text-emerald-300" />
            <p className="mt-2 font-serif text-lg text-gold">Verify your email</p>
            <p className="mt-1 text-xs text-white/70">
              We sent a verification link to your inbox. Confirm it, then return to continue.
            </p>
            <Button
              onClick={() => setPhase("auth")}
              className="mt-4 bg-gold text-black hover:bg-gold/90"
            >
              I have verified — continue
            </Button>
          </div>
        )}

        {phase === "pay" && (
          <div className="rounded-2xl border border-gold/25 bg-black/60 p-5 text-center backdrop-blur-md">
            <p className="font-serif text-lg text-gold">{plan.code.toUpperCase()} · {plan.cycle}</p>
            <p className="mt-1 text-xs text-white/70">Secure checkout via Ziina (AED).</p>
            <Button onClick={startPayment} disabled={busy} className="mt-4 w-full bg-gold text-black hover:bg-gold/90">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Pay with Ziina
            </Button>
          </div>
        )}

        {phase === "polling" && (
          <div className="rounded-2xl border border-gold/25 bg-black/60 p-5 text-center backdrop-blur-md">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-gold" />
            <p className="mt-2 font-serif text-base text-gold">Waiting for payment…</p>
            <p className="mt-1 text-[11px] text-white/60">
              Complete the checkout in the new tab. We poll Ziina every 5 seconds.
            </p>
            {paySession && (
              <Button
                onClick={reopenCheckout}
                className="mt-3 bg-gold text-black hover:bg-gold/90"
              >
                Reopen checkout
              </Button>
            )}
            <button
              onClick={() => {
                clearPaymentState();
                setPhase("pay");
              }}
              className="mt-3 block w-full text-[11px] text-white/50 hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}

        {phase === "blocked" && paySession && (
          <div className="rounded-2xl border border-amber-400/40 bg-black/70 p-5 text-center backdrop-blur-md">
            <AlertTriangle className="mx-auto h-6 w-6 text-amber-300" />
            <p className="mt-2 font-serif text-base text-amber-200">
              We couldn't automatically open Ziina Checkout.
            </p>
            <p className="mt-1 text-[11px] text-white/60">
              Your browser may have blocked the popup. Tap below to open it manually.
            </p>
            <Button
              onClick={reopenCheckout}
              className="mt-4 w-full bg-gold text-black hover:bg-gold/90"
            >
              Open Checkout Again
            </Button>
            <button
              onClick={() => {
                clearPaymentState();
                setPhase("pay");
              }}
              className="mt-2 block w-full text-[11px] text-white/60 hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}