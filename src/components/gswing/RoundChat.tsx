import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMatch, usePlayer } from "@/lib/gswing-store";
import { Send, Smile, Image as ImageIcon } from "lucide-react";

const REACTIONS = ["🔥", "👏", "😂", "⛳", "💪"];

export const RoundChat = () => {
  const [match, setMatch] = useMatch();
  const [player] = usePlayer();
  const [text, setText] = useState("");

  const send = (msg: string, reaction?: string) => {
    if (!msg && !reaction) return;
    setMatch((m) => ({
      ...m,
      chat: [
        ...m.chat,
        { id: `c-${Date.now()}`, from: player.name, text: msg, reaction, ts: new Date().toISOString() },
      ],
    }));
    setText("");
    // Simulated reply from another player
    setTimeout(() => {
      const others = match.players.filter((p) => p.name !== player.name);
      const r = others[Math.floor(Math.random() * others.length)];
      const replies = ["Nice one 👌", "Pressure’s on now", "ACE called that one", "Send the clip!", "Rematch next week?"];
      setMatch((m) => ({
        ...m,
        chat: [...m.chat, { id: `c-${Date.now()}r`, from: r?.name ?? "Nievo", text: replies[Math.floor(Math.random()*replies.length)], ts: new Date().toISOString() }],
      }));
    }, 900);
  };

  return (
    <div className="space-y-3 pb-28">
      <Card className="gradient-card border-gold/30 p-4 shadow-gold">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">Round Chat Room</p>
        <h2 className="font-serif text-xl">{match.course}</h2>
        <p className="text-xs text-muted-foreground">{match.players.map((p) => p.name).join(" · ")}</p>
      </Card>

      <Card className="gradient-card border-gold/20 p-3">
        <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
          {match.chat.map((c) => {
            const mine = c.from === "Riaan";
            return (
              <div key={c.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "ml-auto bg-gold/15 text-foreground" : "bg-secondary text-foreground"}`}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.from}</p>
                <p>{c.text} {c.reaction}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex gap-1">
          {REACTIONS.map((r) => (
            <button key={r} onClick={() => send("", r)} className="rounded-full border border-border px-2 py-1 text-base hover:border-gold/40">{r}</button>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-9 w-9 border-gold/30 p-0"><ImageIcon className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" className="h-9 w-9 border-gold/30 p-0"><Smile className="h-4 w-4" /></Button>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tag a player or share a clip…" className="bg-input" onKeyDown={(e) => e.key === "Enter" && send(text)} />
          <Button size="sm" onClick={() => send(text)} className="gradient-gold text-primary-foreground"><Send className="h-4 w-4" /></Button>
        </div>
      </Card>
    </div>
  );
};