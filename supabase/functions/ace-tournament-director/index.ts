import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { evidence } = await req.json();
    if (!evidence) {
      return new Response(JSON.stringify({ summary: "Not enough data available." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const hasEvidence = !!(evidence.leader || evidence.movers?.length || evidence.bestRound);
    if (!hasEvidence) {
      return new Response(JSON.stringify({ summary: "Not enough data available." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const system = `You are the G Swing AI Tournament Director. Speak like a calm, premium PGA Tour broadcaster.
RULES:
- Use ONLY the JSON evidence provided. Do NOT invent scores, names, holes, or weather.
- If a field is missing/null, omit that sentence. Never fabricate.
- Reply in 4-6 short sentences. No bullet points. No emojis.
- Mention leader, biggest mover (if any), best round (if any), birdies leader (if any), and a closing line about the field.
- If no useful evidence, reply exactly: "Not enough data available."`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Tournament evidence:\n${JSON.stringify(evidence, null, 2)}` },
        ],
      }),
    });

    if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (res.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: "AI gateway error", detail: txt }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await res.json();
    const summary = json.choices?.[0]?.message?.content?.trim() || "Not enough data available.";
    return new Response(JSON.stringify({ summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});