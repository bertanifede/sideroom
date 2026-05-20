"use client";

import { RefObject, useEffect, useState } from "react";
import { diag, getDiagSnapshot } from "@/lib/diagnostics";
import type { DiagSnapshot } from "@/lib/diagnostics";

interface DebugOverlayProps {
  audioRef: RefObject<HTMLAudioElement | null>;
}

/**
 * Debug-only on-screen panel — rendered only with `?debug=1`. Surfaces the
 * live diagnostic counters so a mobile tester can screenshot them (no cable
 * / no remote console needed).
 */
export default function DebugOverlay({ audioRef }: DebugOverlayProps) {
  const [snap, setSnap] = useState<DiagSnapshot | null>(null);
  const [rate, setRate] = useState(1);
  const [pos, setPos] = useState(0);

  useEffect(() => {
    if (!diag.enabled) return;
    const id = setInterval(() => {
      setSnap(getDiagSnapshot());
      const a = audioRef.current;
      setRate(a ? a.playbackRate : 1);
      setPos(a ? a.currentTime : 0);
    }, 500);
    return () => clearInterval(id);
  }, [audioRef]);

  if (!diag.enabled || !snap) return null;

  const c = snap.totals;
  const avgDrift = c.heartbeats > 0 ? c.driftSum / c.heartbeats : 0;

  return (
    <div
      className="fixed top-1.5 left-1.5 z-[100] pointer-events-none select-none
                 max-w-[94vw] rounded-md bg-black/85 text-white
                 font-mono text-[11px] leading-snug p-2 space-y-0.5"
    >
      <div className="font-bold text-emerald-400">
        diag · t {pos.toFixed(1)}s · rate {rate.toFixed(2)}
      </div>
      <div>
        hb {c.heartbeats} · seeks {c.seeks} · nudges {c.nudges} · stalls {c.stalls}{" "}
        ({(c.stallMsTotal / 1000).toFixed(1)}s) · jank {c.jankFrames}
      </div>
      <div>
        drift last {snap.lastDrift.toFixed(2)}s · avg {avgDrift.toFixed(2)}s · max{" "}
        {c.driftMax.toFixed(2)}s · last {snap.lastAction}
      </div>
      <div className="text-white/40 pt-0.5">recent (newest first) —</div>
      {snap.recentEvents
        .slice()
        .reverse()
        .map((e, i) => (
          <div key={i} className="text-white/80 break-all">
            +{e.t.toFixed(1)}s {e.line}
          </div>
        ))}
    </div>
  );
}
