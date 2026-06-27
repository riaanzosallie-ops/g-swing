import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useGswingMembership } from "@/hooks/useGswingMembership";

type Member = {
  user_id: string;
  plan_code: string;
  status: string;
  billing_cycle: string;
  source: string;
  current_period_end: string | null;
  is_owner: boolean;
};
type AuditRow = {
  id: string;
  event_type: string;
  plan_code: string | null;
  created_at: string;
  details: unknown;
};

type GrantKind =
  | "free"
  | "premium"
  | "elite"
  | "lifetime_premium"
  | "lifetime_elite"
  | "suspend"
  | "reactivate"
  | "downgrade";

export function GswingMembershipManager() {
  const { isOwner, loading } = useGswingMembership();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<{ id: string; email: string } | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    if (!target) return;
    const { data } = await supabase.rpc("get_effective_gswing_membership", { _user_id: target.id });
    setMember(data?.[0] ?? null);
    const { data: rows } = await supabase
      .from("gswing_membership_audit")
      .select("id, event_type, plan_code, created_at, details")
      .eq("user_id", target.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setAudit((rows ?? []) as AuditRow[]);
  }, [target]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function search() {
    if (!email) return;
    setBusy(true);
    // Look up via auth.users requires service role — use audit/membership row by email-mapped profile.
    // Fallback: ask backend admin function. For now, expect the owner to paste the user id if email lookup fails.
    const { data, error } = await supabase
      .from("gswing_user_memberships")
      .select("user_id")
      .limit(1);
    setBusy(false);
    if (error || !data?.length) {
      toast({ title: "User lookup limited", description: "Paste the user UUID below to manage." });
    }
    // For UUID paste mode:
    if (/^[0-9a-f-]{36}$/i.test(email)) {
      setTarget({ id: email, email: email });
    } else {
      toast({ title: "Search by user UUID", description: "Email lookup requires an owner edge function (next iteration)." });
    }
  }

  async function applyGrant(kind: GrantKind) {
    if (!target) return;
    setBusy(true);
    try {
      if (kind === "suspend" || kind === "reactivate") {
        await supabase.from("gswing_membership_overrides").insert({
          user_id: target.id,
          override_type: kind === "suspend" ? "suspend" : "reactivate",
          reason: note || null,
        });
        if (kind === "suspend") {
          await supabase
            .from("gswing_user_memberships")
            .update({ status: "suspended" })
            .eq("user_id", target.id);
        } else {
          await supabase
            .from("gswing_user_memberships")
            .update({ status: "active" })
            .eq("user_id", target.id);
        }
      } else if (kind === "downgrade") {
        await supabase.from("gswing_user_memberships").upsert(
          {
            user_id: target.id,
            plan_code: "free",
            billing_cycle: "none",
            status: "active",
            activated_at: new Date().toISOString(),
            current_period_end: null,
          },
          { onConflict: "user_id" },
        );
      } else {
        const isLifetime = kind.startsWith("lifetime_");
        const planCode = kind.replace("lifetime_", "");
        await supabase.from("gswing_membership_overrides").insert({
          user_id: target.id,
          override_type: isLifetime ? "lifetime" : "grant",
          plan_code: planCode,
          reason: note || null,
        });
        await supabase.from("gswing_user_memberships").upsert(
          {
            user_id: target.id,
            plan_code: planCode,
            billing_cycle: isLifetime ? "lifetime" : "monthly",
            status: "active",
            activated_at: new Date().toISOString(),
            current_period_end: isLifetime ? null : new Date(Date.now() + 30 * 86400000).toISOString(),
          },
          { onConflict: "user_id" },
        );
      }
      await supabase.from("gswing_membership_audit").insert({
        user_id: target.id,
        event_type: `owner_${kind}`,
        details: { note: note || null },
      });
      toast({ title: "Membership updated" });
      setNote("");
      await refresh();
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "unknown" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;
  if (!isOwner) {
    return (
      <div className="rounded-xl border border-gold/30 bg-black/60 p-4 text-center text-sm text-gold-soft">
        Owner-only area.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/25 bg-black/60 p-4 backdrop-blur-md">
        <Label className="text-xs">Find member by user UUID</Label>
        <div className="mt-1 flex gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user UUID" />
          <Button onClick={search} disabled={busy} className="bg-gold text-black hover:bg-gold/90">
            Find
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-white/50">
          Tip: copy a user UUID from the audit table. Email lookup (server-side) ships in the next iteration.
        </p>
      </div>

      {target && (
        <div className="rounded-2xl border border-gold/25 bg-black/60 p-4 backdrop-blur-md">
          <div className="text-xs text-white/60">User</div>
          <div className="font-mono text-[11px] text-white/85 break-all">{target.id}</div>
          {member ? (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-white/55">Plan:</span> <span className="text-gold">{member.plan_code}</span></div>
              <div><span className="text-white/55">Status:</span> <span className="text-gold">{member.status}</span></div>
              <div><span className="text-white/55">Source:</span> {member.source}</div>
              <div><span className="text-white/55">Owner:</span> {String(member.is_owner)}</div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-white/55">No membership row yet.</p>
          )}

          <Label className="mt-3 block text-xs">Note (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {(["free", "premium", "elite", "lifetime_premium", "lifetime_elite", "suspend", "reactivate", "downgrade"] as GrantKind[]).map(
              (k) => (
                <Button
                  key={k}
                  disabled={busy}
                  onClick={() => applyGrant(k)}
                  variant="outline"
                  className="border-gold/30 bg-black/40 text-gold hover:bg-gold/10"
                >
                  {k.replace("_", " ")}
                </Button>
              ),
            )}
          </div>
        </div>
      )}

      {target && audit.length > 0 && (
        <div className="rounded-2xl border border-gold/25 bg-black/60 p-4 backdrop-blur-md">
          <div className="text-xs uppercase tracking-widest text-gold-soft">Audit</div>
          <ul className="mt-2 space-y-1 text-[11px] text-white/80">
            {audit.map((row) => (
              <li key={row.id} className="flex justify-between gap-2">
                <span>{row.event_type}{row.plan_code ? ` · ${row.plan_code}` : ""}</span>
                <span className="text-white/45">{new Date(row.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}