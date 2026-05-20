/**
 * Diagnostic instrumentation — gated entirely behind the `?debug=1` query flag.
 * A complete no-op (zero console output, zero overhead) when the flag is absent.
 */

export interface DiagFlags {
  debug: boolean;
  noAnalyser: boolean;
}

/** Pure: parse diagnostic toggle flags from a URL query string. */
export function parseDiagFlags(search: string): DiagFlags {
  const params = new URLSearchParams(search);
  return {
    debug: params.get("debug") === "1",
    noAnalyser: params.get("noanalyser") === "1",
  };
}

const flags: DiagFlags = parseDiagFlags(
  typeof window !== "undefined" ? window.location.search : ""
);

interface DiagCounters {
  heartbeats: number;
  seeks: number;
  nudges: number;
  driftSum: number;
  driftMax: number;
  stalls: number;
  stallMsTotal: number;
  jankFrames: number;
}

function emptyCounters(): DiagCounters {
  return {
    heartbeats: 0,
    seeks: 0,
    nudges: 0,
    driftSum: 0,
    driftMax: 0,
    stalls: 0,
    stallMsTotal: 0,
    jankFrames: 0,
  };
}

let counters = emptyCounters();
let summaryTimer: ReturnType<typeof setInterval> | null = null;

export const diag = {
  enabled: flags.debug,
  flags,

  log(category: string, event: string, data?: Record<string, unknown>): void {
    if (!flags.debug) return;
    const t = (performance.now() / 1000).toFixed(2);
    console.log(`[diag:${category}] +${t}s ${event}`, data ?? "");
  },

  recordHeartbeat(driftAbs: number, action: "none" | "nudge" | "seek"): void {
    if (!flags.debug) return;
    counters.heartbeats += 1;
    counters.driftSum += driftAbs;
    counters.driftMax = Math.max(counters.driftMax, driftAbs);
    if (action === "seek") counters.seeks += 1;
    if (action === "nudge") counters.nudges += 1;
  },

  recordStall(durationMs: number): void {
    if (!flags.debug) return;
    counters.stalls += 1;
    counters.stallMsTotal += durationMs;
  },

  recordJankFrame(): void {
    if (!flags.debug) return;
    counters.jankFrames += 1;
  },
};

/** Starts the 30s rolling summary. Safe to call repeatedly. */
export function initDiagnostics(): void {
  if (!flags.debug || summaryTimer !== null || typeof window === "undefined") {
    return;
  }
  summaryTimer = setInterval(() => {
    const c = counters;
    const avgDrift = c.heartbeats > 0 ? c.driftSum / c.heartbeats : 0;
    console.log(
      `[diag:summary] 30s — ${c.heartbeats} heartbeats · ${c.seeks} seeks · ` +
        `${c.nudges} nudges · drift avg ${avgDrift.toFixed(2)}s max ${c.driftMax.toFixed(2)}s · ` +
        `${c.stalls} stalls totaling ${(c.stallMsTotal / 1000).toFixed(1)}s · ` +
        `${c.jankFrames} janky frames`
    );
    counters = emptyCounters();
  }, 30_000);
}
