import { Check } from "lucide-react";

export type PlanChoice = {
  code: "free" | "premium" | "elite";
  cycle: "monthly" | "yearly";
};

const PLANS = [
  {
    code: "free" as const,
    title: "Free",
    monthly: 0,
    yearly: 0,
    features: ["Scorecard & basic GPS", "Community access"],
  },
  {
    code: "premium" as const,
    title: "Premium",
    monthly: 49,
    yearly: 490,
    features: ["Full GPS Caddie", "Hazard & weather intelligence", "AI Caddie ACE", "Shot tracking"],
  },
  {
    code: "elite" as const,
    title: "Elite",
    monthly: 99,
    yearly: 990,
    features: ["Everything in Premium", "Tournaments & Broadcast", "Live TV & Awards", "Course mapper"],
  },
];

export function PlanPicker({
  value,
  onChange,
}: {
  value: PlanChoice;
  onChange: (v: PlanChoice) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-1 rounded-full border border-gold/30 bg-black/40 p-0.5 text-[10px] uppercase tracking-widest">
        {(["monthly", "yearly"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange({ ...value, cycle: c })}
            className={`rounded-full px-3 py-1 font-semibold transition ${
              value.cycle === c ? "bg-gold text-black" : "text-gold-soft"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid gap-2">
        {PLANS.map((p) => {
          const selected = value.code === p.code;
          const price = value.cycle === "monthly" ? p.monthly : p.yearly;
          return (
            <button
              key={p.code}
              type="button"
              onClick={() => onChange({ ...value, code: p.code })}
              className={`text-left rounded-xl border p-3 transition ${
                selected
                  ? "border-gold bg-gold/10 shadow-[0_0_18px_rgba(245,200,75,0.25)]"
                  : "border-gold/20 bg-black/40 hover:border-gold/50"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div className="font-serif text-base text-gold">{p.title}</div>
                <div className="text-sm text-white/90 tabular-nums">
                  {price === 0 ? "Free" : `AED ${price}`}
                  {price > 0 && (
                    <span className="text-[10px] text-white/55"> / {value.cycle === "monthly" ? "mo" : "yr"}</span>
                  )}
                </div>
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px] text-white/70">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-300" /> {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}