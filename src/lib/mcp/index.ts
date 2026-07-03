import { defineMcp } from "@lovable.dev/mcp-js";
import listCourses from "./tools/list-courses";
import getCourse from "./tools/get-course";
import getHoleGps from "./tools/get-hole-gps";

/**
 * G-Swing MCP server.
 *
 * Exposes the public G-Swing golf course directory and per-hole GPS
 * geometry to MCP clients (ChatGPT, Claude, Cursor, etc.). Read-only
 * and anonymous — no user data is exposed.
 */
export default defineMcp({
  name: "g-swing-mcp",
  title: "G-Swing MCP",
  version: "0.1.0",
  instructions:
    "Tools for the G-Swing golf app. Use `list_courses` to discover courses, `get_course` for full detail and hole list, and `get_hole_gps` for per-hole tee/green/hazard geometry (optionally with player distances when lat/lng are supplied).",
  tools: [listCourses, getCourse, getHoleGps],
});