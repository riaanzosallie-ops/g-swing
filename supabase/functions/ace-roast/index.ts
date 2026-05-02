import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are ACE, the witty AI Caddie inside G Swing. After a match you produce a short, fun, golf-themed "roast & toast" recap. Rules:
- 3 to 5 short sentences total.
- Praise the winner's standout moments.
- Light, playful jabs at the losers — golf humour only, NEVER offensive, no insults about looks, identity, or anything personal.
- Mention specific hole numbers / scores if provided.
- End with a one-line caption suitable for social sharing, prefixed with "CAPTION:".`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { match } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const summary = `Course: ${match.course}\nType: ${match.type}\nStake: ${match.currency} ${match.stake}\nPlayers:\n` +
      match.players.map((p: any) => {
        const total = p.scores.reduce((a: number, b: number) => a + b, 0);
        return `- ${p.name} (hcp ${p.handicap}) total ${total} over ${p.scores.length} holes [${p.scores.join(",")}]`;
      }).join("\n") + `\nWinner: ${match.winnerName}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Generate the roast & toast for this round:\n${summary}` },
        ],
      }),
    });

    if (!r.ok) {
      if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (r.status === 402) return new Response(JSON.stringify({ error: "Add credits" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "err" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});