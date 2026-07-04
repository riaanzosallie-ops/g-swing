// Owner/admin-only Rendering Studio route.
// Uses the existing admin gate (useGswingAdmin). Normal users see nothing.

import { Link } from "react-router-dom";
import { useGswingAdmin } from "@/lib/use-gswing-admin";
import { RenderingStudio } from "@/components/gswing/admin/RenderingStudio";

export default function GswingRenderingStudioPage() {
  const state = useGswingAdmin();

  if (state.status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-black text-white/70">
        Checking access…
      </div>
    );
  }
  if (state.status === "anon") {
    return (
      <div className="grid min-h-screen place-items-center bg-black px-6 text-center text-white">
        <div className="space-y-3">
          <h1 className="font-serif text-xl text-amber-200">Rendering Studio</h1>
          <p className="text-sm text-white/60">Sign in with an owner account to continue.</p>
          <Link to="/auth" className="text-sm text-emerald-300 underline">Go to sign in</Link>
        </div>
      </div>
    );
  }
  if (state.status === "denied") {
    return (
      <div className="grid min-h-screen place-items-center bg-black px-6 text-center text-white">
        <div className="space-y-2">
          <h1 className="font-serif text-xl text-amber-200">Rendering Studio</h1>
          <p className="text-sm text-white/60">This tool is available to G-Swing owners only.</p>
          <Link to="/" className="text-sm text-emerald-300 underline">Return home</Link>
        </div>
      </div>
    );
  }
  return <RenderingStudio />;
}
