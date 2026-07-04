import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

const buildCommitSha = (() => {
  // 1) Common CI/hosting env vars (Lovable, GitHub Actions, Vercel, Cloudflare Pages, Render, Netlify)
  const envSha =
    process.env.LOVABLE_COMMIT_SHA ||
    process.env.LOVABLE_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.COMMIT_REF ||
    process.env.SOURCE_VERSION;
  if (envSha) return envSha.slice(0, 12);
  // 2) git binary (local dev)
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {}
  // 3) Read .git/HEAD directly (works when git binary isn't in PATH but repo files exist)
  try {
    if (existsSync(".git/HEAD")) {
      const head = readFileSync(".git/HEAD", "utf8").trim();
      if (head.startsWith("ref: ")) {
        const refPath = ".git/" + head.slice(5).trim();
        if (existsSync(refPath)) {
          return readFileSync(refPath, "utf8").trim().slice(0, 12);
        }
        // packed-refs fallback
        if (existsSync(".git/packed-refs")) {
          const packed = readFileSync(".git/packed-refs", "utf8");
          const ref = head.slice(5).trim();
          const m = packed.split("\n").find((l) => l.endsWith(" " + ref));
          if (m) return m.split(" ")[0].slice(0, 12);
        }
      } else {
        // detached HEAD — HEAD itself is a SHA
        return head.slice(0, 12);
      }
    }
  } catch {}
  return "unknown";
})();

const buildTimestamp = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), mcpPlugin()].filter(Boolean),
  define: {
    __GSWING_BUILD_SHA__: JSON.stringify(buildCommitSha),
    __GSWING_BUILD_TIME__: JSON.stringify(buildTimestamp),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
