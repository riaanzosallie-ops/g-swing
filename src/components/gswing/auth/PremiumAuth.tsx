import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import heroBg from "@/assets/gswing-hero-v3.jpg";
import {
  Apple,
  ArrowLeft,
  Crown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { PlanPicker, type PlanChoice } from "@/components/gswing/membership/PlanPicker";

const PLAN_STORAGE_KEY = "gswing.signup.plan";

type Mode = "login" | "register";
type Phase = "auth" | "verify";

export function PremiumAuth({
  onAuthenticated,
  onBack,
}: {
  onAuthenticated: () => void;
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [phase, setPhase] = useState<Phase>("auth");
  const [busy, setBusy] = useState(false);

  // Shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);

  // Register
  const [fullName, setFullName] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [agree, setAgree] = useState(false);
  const [plan, setPlan] = useState<PlanChoice>({ code: "free", cycle: "monthly" });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PLAN_STORAGE_KEY);
      if (stored) setPlan(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  function persistPlan(next: PlanChoice) {
    setPlan(next);
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(next));
  }

  function routeAfterAuth(selected: PlanChoice) {
    if (selected.code === "free") {
      localStorage.removeItem(PLAN_STORAGE_KEY);
      onAuthenticated();
    } else {
      navigate("/auth", { replace: true });
    }
  }

  async function handleGoogle() {
    persistPlan(plan);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) {
        toast.error("Google sign-in failed", {
          description: String(result.error.message ?? result.error),
        });
        return;
      }
      if (result.redirected) return;
      routeAfterAuth(plan);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      toast.error("Enter your email and password.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("not confirmed") || msg.includes("verified")) {
        setPhase("verify");
        return;
      }
      toast.error("Incorrect email or password.");
      return;
    }
    toast.success("Welcome back");
    onAuthenticated();
  }

  async function handleRegister() {
    if (!fullName || !email || !password) {
      toast.error("Please fill in your name, email and password.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPw) {
      toast.error("Passwords don't match.");
      return;
    }
    if (!agree) {
      toast.error("Please accept the Terms to continue.");
      return;
    }
    persistPlan(plan);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/auth?verified=1",
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error("Signup failed", { description: error.message });
      return;
    }
    setPhase("verify");
  }

  async function resendVerification() {
    if (!email) {
      toast.error("Enter your email first.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (error) toast.error("Could not resend", { description: error.message });
    else toast.success("Verification email sent.");
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      <img
        src={heroBg}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80 [animation:splash-pan_40s_ease-in-out_infinite_alternate]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/80 via-black/55 to-black/95" />
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_80%_at_50%_45%,transparent_50%,rgba(0,0,0,0.7)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen [background:radial-gradient(50%_25%_at_25%_15%,rgba(255,210,140,0.18),transparent_70%),radial-gradient(45%_25%_at_80%_18%,rgba(255,240,200,0.12),transparent_70%)] [animation:splash-clouds_30s_ease-in-out_infinite_alternate]" />

      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back to welcome"
          className="absolute left-3 top-3 z-30 flex items-center gap-1.5 rounded-full border border-gold/25 bg-black/45 px-3 py-1.5 text-[11px] uppercase tracking-[0.25em] text-gold/90 backdrop-blur-md transition hover:border-gold/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-4 pb-10 pt-14 sm:px-6">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <div
            className="text-[64px] font-black leading-none tracking-tight [font-family:Georgia,'Times_New_Roman',serif] text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(180deg,#fff6c9 0%,#f3c969 35%,#a87012 75%,#7a4d0a 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.55))",
            }}
          >
            G-SWING
          </div>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.45em] text-white/80 animate-fade-in">
            {phase === "verify"
              ? "Verify Your Email"
              : mode === "login"
                ? "Welcome Back"
                : "Join the Club"}
          </p>
        </div>

        {phase === "verify" ? (
          <VerifyEmailCard
            email={email}
            busy={busy}
            onResend={resendVerification}
            onChangeEmail={() => setPhase("auth")}
            onBack={() => setPhase("auth")}
          />
        ) : (
          <div
            className="mt-6 w-full rounded-[28px] border border-gold/25 bg-emerald-950/35 p-5 backdrop-blur-xl animate-fade-in"
            style={{
              boxShadow:
                "0 20px 60px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,215,140,0.15)",
            }}
          >
            {/* Segmented tabs */}
            <div className="mx-auto flex w-full items-center rounded-full border border-gold/25 bg-black/45 p-1">
              {(["login", "register"] as const).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={
                      "flex-1 rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] transition-all duration-300 " +
                      (active
                        ? "bg-gradient-to-b from-[#ffe89a] via-[#f0c45a] to-[#b87a18] text-black shadow-[0_8px_24px_-8px_rgba(240,196,90,0.55)]"
                        : "text-gold-soft hover:text-gold")
                    }
                  >
                    {m === "login" ? "Login" : "Register"}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-3">
              {mode === "register" && (
                <Field
                  icon={UserIcon}
                  label="Full name"
                  type="text"
                  value={fullName}
                  onChange={setFullName}
                  autoComplete="name"
                />
              )}
              <Field
                icon={Mail}
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <Field
                icon={Lock}
                label="Password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={setPassword}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                trailing={
                  <button
                    type="button"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    onClick={() => setShowPw((s) => !s)}
                    className="rounded-full p-1 text-gold-soft hover:text-gold"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              {mode === "register" && (
                <Field
                  icon={Lock}
                  label="Confirm password"
                  type={showPw ? "text" : "password"}
                  value={confirmPw}
                  onChange={setConfirmPw}
                  autoComplete="new-password"
                />
              )}

              {mode === "login" ? (
                <div className="flex items-center justify-between text-[11px] text-white/75">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="accent-[hsl(var(--gold))]"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) {
                        toast.error("Enter your email first.");
                        return;
                      }
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: window.location.origin + "/auth?reset=1",
                      });
                      if (error) toast.error(error.message);
                      else toast.success("Password reset email sent.");
                    }}
                    className="text-gold-soft hover:text-gold"
                  >
                    Forgot password?
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2 pt-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-soft">
                      Choose your membership
                    </div>
                    <PlanPicker value={plan} onChange={persistPlan} />
                  </div>
                  <label className="flex items-start gap-2 text-[11px] text-white/75">
                    <input
                      type="checkbox"
                      checked={agree}
                      onChange={(e) => setAgree(e.target.checked)}
                      className="mt-0.5 accent-[hsl(var(--gold))]"
                    />
                    <span>
                      I agree to the <span className="text-gold-soft">Terms</span> and
                      <span className="text-gold-soft"> Privacy Policy</span>.
                    </span>
                  </label>
                </>
              )}

              <button
                disabled={busy}
                onClick={mode === "login" ? handleLogin : handleRegister}
                className="group relative mt-1 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.25em] text-black/90 transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(180deg,#ffe89a 0%,#f0c45a 45%,#b87a18 100%)",
                  boxShadow:
                    "0 14px 40px -10px rgba(240,196,90,0.55), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 0 rgba(120,70,10,0.4)",
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "login" ? "Login" : "Create Account"}
              </button>

              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-gold/60" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/75">
                  Or continue with
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/40 to-gold/60" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={busy}
                  onClick={handleGoogle}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-neutral-900 to-black text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition hover:border-gold/40 disabled:opacity-60"
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-bold text-black">
                    G
                  </span>
                  Google
                </button>
                <button
                  disabled
                  title="Coming soon"
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-neutral-900 to-black text-[13px] font-medium text-white/60 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                >
                  <Apple className="h-4 w-4" /> Apple
                  <span className="ml-1 rounded-full bg-gold/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-gold-soft">
                    Soon
                  </span>
                </button>
              </div>

              <div className="pt-2 text-center text-[11px] text-white/70">
                {mode === "login" ? (
                  <>
                    New to G-Swing?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("register")}
                      className="font-semibold text-gold hover:underline"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already a member?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="font-semibold text-gold hover:underline"
                    >
                      Login
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/55">
          <ShieldCheck className="h-3 w-3 text-gold/80" />
          Secure · Private · Premium
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.35em] text-gold-soft/80">
          <Crown className="h-3 w-3" />
          Owner · Creator · Riaanzo
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  type,
  value,
  onChange,
  autoComplete,
  trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="group block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-soft">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-xl border border-gold/20 bg-black/45 px-3 py-2.5 transition-all focus-within:border-gold focus-within:shadow-[0_0_0_3px_rgba(240,196,90,0.18)]">
        <Icon className="h-4 w-4 text-gold-soft" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/30 focus:outline-none"
        />
        {trailing}
      </div>
    </label>
  );
}

function VerifyEmailCard({
  email,
  busy,
  onResend,
  onChangeEmail,
  onBack,
}: {
  email: string;
  busy: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
  onBack: () => void;
}) {
  return (
    <div
      className="mt-6 w-full rounded-[28px] border border-gold/25 bg-emerald-950/35 p-6 text-center backdrop-blur-xl animate-fade-in"
      style={{
        boxShadow:
          "0 20px 60px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,215,140,0.15)",
      }}
    >
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold/30 bg-black/40">
        <Mail className="h-6 w-6 text-gold" />
      </div>
      <h2 className="mt-4 font-serif text-xl text-gold">Verify Your Email</h2>
      <p className="mt-2 text-[12px] text-white/75">
        We've sent a verification link to{" "}
        <span className="text-white">{email || "your inbox"}</span>. Confirm it,
        then return to continue.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <a
          href="https://mail.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ffe89a] via-[#f0c45a] to-[#b87a18] px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-black"
        >
          <Mail className="h-3.5 w-3.5" /> Open Email
        </a>
        <button
          disabled={busy}
          onClick={onResend}
          className="flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-black/40 px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-gold disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Resend
        </button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-gold-soft">
        <button onClick={onChangeEmail} className="hover:text-gold">
          Change email
        </button>
        <span className="text-white/20">·</span>
        <button onClick={onBack} className="hover:text-gold">
          Back
        </button>
      </div>
    </div>
  );
}