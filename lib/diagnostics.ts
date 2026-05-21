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

let counters = emptyCounters(); // 30s rolling window — feeds the console summary
const totals = emptyCounters(); // cumulative, never reset — feeds the on-screen overlay
let lastDrift = 0;
let lastAction = "—";
let summaryTimer: ReturnType<typeof setInterval> | null = null;

export interface DiagEvent {
  t: number; // seconds since page load
  line: string;
}

const recentEvents: DiagEvent[] = [];
const MAX_EVENTS = 12;

export interface DiagSnapshot {
  totals: DiagCounters;
  lastDrift: number;
  lastAction: string;
  recentEvents: DiagEvent[];
}

/** Current cumulative diagnostic state — read by the on-screen DebugOverlay. */
export function getDiagSnapshot(): DiagSnapshot {
  return {
    totals: { ...totals },
    lastDrift,
    lastAction,
    recentEvents: recentEvents.slice(),
  };
}

export const diag = {
  enabled: flags.debug,
  flags,

  log(category: string, event: string, data?: Record<string, unknown>): void {
    if (!flags.debug) return;
    const t = performance.now() / 1000;
    console.log(`[diag:${category}] +${t.toFixed(2)}s ${event}`, data ?? "");
    const dataStr = data ? " " + JSON.stringify(data) : "";
    recentEvents.push({ t, line: `${category} ${event}${dataStr}` });
    if (recentEvents.length > MAX_EVENTS) recentEvents.shift();
  },

  recordHeartbeat(driftAbs: number, action: "none" | "nudge" | "seek"): void {
    if (!flags.debug) return;
    for (const c of [counters, totals]) {
      c.heartbeats += 1;
      c.driftSum += driftAbs;
      c.driftMax = Math.max(c.driftMax, driftAbs);
      if (action === "seek") c.seeks += 1;
      if (action === "nudge") c.nudges += 1;
    }
    lastDrift = driftAbs;
    lastAction = action;
  },

  recordStall(durationMs: number): void {
    if (!flags.debug) return;
    for (const c of [counters, totals]) {
      c.stalls += 1;
      c.stallMsTotal += durationMs;
    }
  },

  recordJankFrame(): void {
    if (!flags.debug) return;
    counters.jankFrames += 1;
    totals.jankFrames += 1;
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
