import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are ACE Coach inside the G Swing app — a premium AI golf coach.

CRITICAL RULES — DO NOT BREAK:
1. You only analyse what is in the supplied evidence pack. You never invent shots, scores, weather, emotions, or trends.
2. Every claim you make MUST cite the round_id(s) or shot_id(s) from the evidence pack inside square brackets, like [shot:abc123] or [round:r-9].
3. If the evidence pack is empty OR the question cannot be answered from the evidence, reply with EXACTLY the string: "Not enough data available." Do not pad it with extra sentences.
4. No generic golf tips. No fabricated personal records. No claims about clubs the golfer does not own. No assumed wind, temperature, slope, or course conditions.
5. Keep responses short, premium, and direct. Bullet points are encouraged. Use yards unless told otherwise.
6. Focus areas: club selection, miss patterns, scoring strategy, recovery, putting tendencies, last-5 vs last-10 trends.`;

interface EvidencePack {
  current_round?: unknown;
  last_5_rounds?: unknown[];
  last_10_rounds?: unknown[];
  club_distances?: unknown[];
  miss_pattern?: unknown;
  stats?: unknown;
  shots?: unknown[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const question: string = typeof body?.question === "string" ? body.question.trim() : "";
    const evidence: EvidencePack = body?.evidence ?? {};
    if (!question) {
      return new Response(JSON.stringify({ error: "Question required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guardrail: if the evidence pack has no usable signal, return the canned
    // response WITHOUT calling the model — saves credits and guarantees the
    // contract.
    const hasShots = Array.isArray(evidence.shots) && evidence.shots.length > 0;
    const hasRounds =
      (Array.isArray(evidence.last_5_rounds) && evidence.last_5_rounds.length > 0) ||
      (Array.isArray(evidence.last_10_rounds) && evidence.last_10_rounds.length > 0) ||
      !!evidence.current_round;
    const hasClubs = Array.isArray(evidence.club_distances) && evidence.club_distances.length > 0;
    if (!hasShots && !hasRounds && !hasClubs) {
      return new Response(
        JSON.stringify({ answer: "Not enough data available.", citations: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPayload = [
      `Golfer question: ${question}`,
      ``,
      `EVIDENCE PACK (the ONLY data you may use):`,
      "```json",
      JSON.stringify(evidence, null, 2),
      "```",
      ``,
      `Reply in <= 6 short bullet points. Every bullet must end with at least one [shot:...] or [round:...] citation. If you cannot answer from the evidence above, reply with EXACTLY: "Not enough data available."`,
    ].join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPayload },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "ACE Coach is busy. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds to your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("ace-coach gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const answer: string = data?.choices?.[0]?.message?.content?.trim() ?? "Not enough data available.";
    const citations = Array.from(
      new Set(
        [...answer.matchAll(/\[(shot|round):([^\]]+)\]/g)].map((m) => `${m[1]}:${m[2]}`),
      ),
    );
    const safe =
      citations.length === 0 && !/not enough data available/i.test(answer)
        ? "Not enough data available."
        : answer;

    return new Response(JSON.stringify({ answer: safe, citations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ace-coach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});