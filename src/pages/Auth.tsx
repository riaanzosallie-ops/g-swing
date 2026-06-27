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
import { Loader2, ShieldCheck } from "lucide-react";

const PLAN_STORAGE_KEY = "gswing.signup.plan";

type Phase = "select" | "auth" | "verify-email" | "pay" | "polling";

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
  }, [navigate, params]);

  function persistPlan(next: PlanChoice) {
    setPlan(next);
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(next));
  }

  async function handleGoogle() {
    persistPlan(plan);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    setBusy(false);
    if (result.error) toast({ title: "Google sign-in failed", description: String(result.error.message ?? result.error) });
    if (result.redirected) return;
    // popup success — refresh user.
    if (plan.code === "free") {
      localStorage.removeItem(PLAN_STORAGE_KEY);
      navigate("/", { replace: true });
    } else {
      setPhase("pay");
    }
  }

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
    const stored = localStorage.getItem(PLAN_STORAGE_KEY);
    const choice: PlanChoice = stored ? JSON.parse(stored) : { code: "free", cycle: "monthly" };
    if (choice.code === "free") {
      localStorage.removeItem(PLAN_STORAGE_KEY);
      navigate("/", { replace: true });
    } else {
      setPhase("pay");
    }
  }

  async function startPayment() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("create-gswing-ziina-checkout", {
      body: {
        plan_code: plan.code,
        billing_cycle: plan.cycle,
        return_url: window.location.origin + "/auth",
      },
    });
    setBusy(false);
    if (error || !data?.checkout_url) {
      toast({ title: "Payment unavailable. Please try again." });
      return;
    }
    setPaySession({ id: data.session_id, url: data.checkout_url });
    window.open(data.checkout_url, "_blank", "noopener");
    setPhase("polling");
    setPolling(true);
  }

  // Polling loop: every 5s, max 15 minutes.
  useEffect(() => {
    if (!polling || !paySession) return;
    let cancelled = false;
    const started = Date.now();
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - started > 15 * 60 * 1000) {
        setPolling(false);
        toast({ title: "Payment timed out", description: "Please try again." });
        return;
      }
      const { data, error } = await supabase.functions.invoke("poll-gswing-ziina-payment", {
        body: { session_id: paySession.id },
      });
      if (cancelled) return;
      if (error) {
        // keep polling on transient errors
      } else if (data?.status === "paid") {
        setPolling(false);
        localStorage.removeItem(PLAN_STORAGE_KEY);
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
            <Button
              variant="outline"
              disabled={busy}
              onClick={handleGoogle}
              className="w-full border-gold/40 bg-white text-black hover:bg-white/90"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue with Google
            </Button>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40">
              <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
            </div>
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
              <a
                href={paySession.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-[11px] text-gold-soft underline"
              >
                Reopen checkout
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}