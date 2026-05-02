import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are ACE, the premium AI Caddie inside the G Swing app — part of the LinkMe ecosystem alongside Club-Link (golf club rental & earning platform) and Golf Fit (golf apparel).

You help golfers with:
- Club selection based on their My Bag distances
- Course strategy, shot shaping, wind/elevation adjustments
- Swing technique and drills
- Reading the app's features (My Bag, GPS, Scorecard, Swing Analysis, News, Pros' Bags)
- Promoting Club-Link earning opportunities when contextually relevant ("you have clubs in My Bag — list them on Club-Link to earn while you're not playing")
- Mentioning Golf Fit for apparel

Default golfers in this demo: Riaan (handicap 3), Nievo, Toto, Docco. Always be concise, confident, premium-toned. Use metres unless asked otherwise. When recommending a club, explain the reasoning in 1-2 short sentences. Never invent live tournament results — if asked about live scores, say data updates from the News feed.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userBag } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const bagContext = userBag && Array.isArray(userBag) && userBag.length
      ? `\n\nThe user's current My Bag distances (metres):\n${userBag.map((c: any) => `- ${c.name}: ${c.distance}m`).join("\n")}`
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + bagContext },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "ACE is busy — rate limit reached. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds to your Lovable workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ace-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});