"use client";

import { useEffect } from "react";
import { diag } from "@/lib/diagnostics";

/** Debug-only: counts dropped animation frames while the party room is open. */
export function useFrameHealth(): void {
  useEffect(() => {
    if (!diag.enabled) return;

    let raf = 0;
    let last = performance.now();

    function tick(now: number): void {
      const delta = now - last;
      last = now;
      if (delta > 32) diag.recordJankFrame();
      if (delta > 100) diag.log("frame", "severe-jank", { ms: Math.round(delta) });
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}
