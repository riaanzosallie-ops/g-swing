import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, X, Bot, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBag } from "@/lib/gswing-store";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "I have 145m to the pin — what club?",
  "Tips for windy conditions in Dubai",
  "How does Club-Link earning work?",
  "Drill to fix my slice",
];

export const AceCaddie = () => {
  const [open, setOpen] = useState(false);
  const [bag] = useBag();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi Riaan — I'm **ACE**, your AI Caddie. Ask me about clubs, swing fixes, course strategy, or anything in G Swing." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("gswing:openAce", handler);
    return () => window.removeEventListener("gswing:openAce", handler);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported on this browser"); return; }
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.continuous = false;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setInput(text);
      setListening(false);
      send(text);
    };
    rec.onerror = () => { setListening(false); toast.error("Voice input failed"); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ace-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
          userBag: bag.filter((c) => c.distance > 0).map((c) => ({ name: c.name, distance: c.distance })),
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("ACE is busy — try again in a moment.");
        else if (resp.status === 402) toast.error("AI credits exhausted.");
        else toast.error("ACE couldn't respond right now.");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let done = false;
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(j);
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              acc += c;
              setMessages((prev) => prev.map((m, idx) => idx === prev.length - 1 ? { ...m, content: acc } : m));
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error talking to ACE.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full gradient-gold shadow-gold animate-glow-pulse",
          open && "hidden"
        )}
        aria-label="Open ACE caddie"
      >
        <Sparkles className="h-6 w-6 text-primary-foreground" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center">
          <div className="flex h-[88vh] w-full max-w-md flex-col rounded-t-3xl border border-gold/30 gradient-card shadow-elegant sm:rounded-3xl">
            <header className="flex items-center justify-between border-b border-gold/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-gold">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-serif text-lg text-gradient-gold">ACE</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Caddie · Live</p>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setOpen(false)}><X /></Button>
            </header>

            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                    m.role === "user"
                      ? "gradient-gold text-primary-foreground rounded-br-sm"
                      : "glass text-foreground rounded-bl-sm"
                  )}>
                    {m.content || (loading && i === messages.length - 1 ? "…" : "")}
                  </div>
                </div>
              ))}
            </div>

            {messages.length <= 2 && (
              <div className="grid grid-cols-2 gap-2 px-4 pb-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-xl border border-gold/20 bg-background/40 p-2 text-left text-xs text-muted-foreground hover:border-gold/50 hover:text-foreground">
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-gold/20 p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask ACE anything…"
                className="flex-1 rounded-full border border-gold/20 bg-background/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold/60 focus:outline-none"
              />
              <Button type="button" size="icon" variant="outline" onClick={toggleVoice}
                className={cn("rounded-full border-gold/30", listening && "bg-gold/20 animate-glow-pulse")}>
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button type="submit" size="icon" className="rounded-full gradient-gold text-primary-foreground" disabled={loading}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};