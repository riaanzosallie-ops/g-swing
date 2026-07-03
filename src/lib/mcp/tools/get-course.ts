import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * G-Swing MCP — get_course
 * Returns a course row plus a compact hole summary (number, par, yardage).
 */
export default defineTool({
  name: "get_course",
  title: "Get course details",
  description:
    "Get full detail for a single course, including its holes (number, par, yardage).",
  inputSchema: {
    course_id: z
      .string()
      .uuid()
      .describe("The course id returned by list_courses."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ course_id }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: course, error } = await supabase
      .from("golf_courses")
      .select("*")
      .eq("id", course_id)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    if (!course) {
      return { content: [{ type: "text", text: "Course not found." }], isError: true };
    }
    const { data: holes } = await supabase
      .from("course_holes")
      .select("hole_number,par,yardage")
      .eq("course_id", course_id)
      .order("hole_number");
    const holesRows = holes ?? [];
    return {
      content: [
        {
          type: "text",
          text: `${course.name} — ${course.city ?? "?"}, ${course.country ?? "?"}\nHoles: ${holesRows.length}\n${holesRows
            .map(
              (h) => `  H${h.hole_number}  Par ${h.par ?? "?"}  ${h.yardage ?? "?"}y`,
            )
            .join("\n")}`,
        },
      ],
      structuredContent: { course, holes: holesRows },
    };
  },
});