import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * G-Swing MCP — list_courses
 * Public directory of golf courses G-Swing has indexed. Read-only,
 * anonymous — safe to expose to any MCP client.
 */
export default defineTool({
  name: "list_courses",
  title: "List golf courses",
  description:
    "List golf courses indexed by G-Swing. Optional country filter and free-text name search. Returns id, name, country, city, holes_count, latitude, longitude.",
  inputSchema: {
    country: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .nullable()
      .describe("ISO country name or code to filter by (e.g. 'United Arab Emirates')."),
    search: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .nullable()
      .describe("Case-insensitive substring match against course name."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .nullable()
      .describe("Max rows to return (default 50, cap 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ country, search, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase
      .from("golf_courses")
      .select("id,name,country,city,holes_count,lat,lng")
      .order("country")
      .order("name")
      .limit(Math.min(limit ?? 50, 200));
    if (country) q = q.ilike("country", `%${country}%`);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    const rows = data ?? [];
    return {
      content: [
        {
          type: "text",
          text: rows.length
            ? `Found ${rows.length} course(s):\n${rows
                .map(
                  (c) =>
                    `- ${c.name} — ${c.city ?? "?"}, ${c.country ?? "?"} (${c.holes_count ?? "?"} holes) [id: ${c.id}]`,
                )
                .join("\n")}`
            : "No courses matched.",
        },
      ],
      structuredContent: { courses: rows },
    };
  },
});