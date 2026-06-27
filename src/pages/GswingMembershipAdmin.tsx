import { GswingMembershipManager } from "@/components/gswing/admin/GswingMembershipManager";

export default function GswingMembershipAdminPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-black to-black px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="font-serif text-2xl text-gold">Membership Manager</h1>
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-soft/80">
          Owner · Creator · RIAANZO
        </p>
        <GswingMembershipManager />
      </div>
    </div>
  );
}