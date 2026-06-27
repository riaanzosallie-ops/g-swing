// G Swing — mapbox-token edge function.
// Returns the public Mapbox pk.* token to the frontend at runtime so the
// build pipeline does not need to bake it into the bundle. The token is a
// public Mapbox token and is safe to expose to the browser; restrict it to
// your domains in the Mapbox dashboard.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const token = Deno.env.get("MAPBOX_PUBLIC_TOKEN");

  if (!token) {
    return new Response(
      JSON.stringify({
        error: "MAPBOX_PUBLIC_TOKEN secret is not configured on the server.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!token.startsWith("pk.")) {
    // Never log the token value itself.
    return new Response(
      JSON.stringify({
        error: "MAPBOX_PUBLIC_TOKEN must be a public token starting with 'pk.'.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
    },
  });
});