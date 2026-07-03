// Non-blocking offline indicator. Watches navigator.onLine and surfaces
// a subtle chip so the golfer knows Play still works from the cache.

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-14 z-30 -translate-x-1/2">
      <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-black/75 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100 backdrop-blur-md">
        <CloudOff className="h-3 w-3" />
        Offline mode active
      </div>
    </div>
  );
}