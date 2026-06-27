import { useEffect, useState } from "react";

const KEY = "gswing.intro.played";

export const LaunchIntro = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
      setShow(true);
      const t = setTimeout(() => setShow(false), 4100);
      return () => clearTimeout(t);
    } catch {
      /* noop */
    }
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className="intro-root fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#050706]"
    >
      {/* soft gold radial */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, hsl(45 80% 35% / 0.35), transparent 55%)",
        }}
      />

      {/* Wordmark */}
      <div className="intro-logo relative">
        <h1 className="relative font-serif text-5xl tracking-[0.3em] text-gradient-gold sm:text-6xl">
          G&nbsp;SWING
          <span
            className="intro-sheen pointer-events-none absolute inset-0 block"
            style={{
              background:
                "linear-gradient(100deg, transparent 35%, hsl(45 100% 80% / 0.7) 50%, transparent 65%)",
              mixBlendMode: "overlay",
            }}
          />
        </h1>
        <p className="intro-tag mt-6 text-center text-[10px] uppercase tracking-[0.55em] text-gold/80">
          Play Smarter · Compete Live
        </p>
      </div>

      {/* Rolling golf ball */}
      <div className="intro-ball pointer-events-none absolute bottom-12 left-0">
        <div
          className="h-4 w-4 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, #ffffff, #d8d8d8 60%, #8a8a8a)",
            boxShadow:
              "0 0 12px hsl(45 80% 60% / 0.55), inset -1px -1px 2px rgba(0,0,0,0.3)",
          }}
        />
      </div>
    </div>
  );
};