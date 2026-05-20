/**
 * Party lifecycle — derived purely from timestamps on the `parties` row.
 */

/** How long after the last track finishes the room stays open before it is
 *  treated as ended (the wind-down cap). */
export const WIND_DOWN_CAP_MS = 60 * 60 * 1000; // 1 hour

/** A party with no explicit end is treated as over this long after its
 *  scheduled start — the existing app-wide expiry rule. */
const SCHEDULED_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface PartyTiming {
  scheduled_at: string;
  playback_ended_at: string | null;
  ended_at: string | null;
}

export type PartyLifecycle = "live" | "winddown" | "ended";

/**
 * Derive a party's lifecycle state. `now` is epoch milliseconds.
 *
 * - `ended`    — the host ended it, or 1h past wind-down, or 6h past start.
 * - `winddown` — the last track finished; the room stays open for chat/notes.
 * - `live`     — playing normally.
 */
export function partyLifecycle(party: PartyTiming, now: number): PartyLifecycle {
  if (party.ended_at) return "ended";
  if (now - new Date(party.scheduled_at).getTime() > SCHEDULED_EXPIRY_MS) {
    return "ended";
  }
  if (party.playback_ended_at) {
    const sinceFinish = now - new Date(party.playback_ended_at).getTime();
    return sinceFinish > WIND_DOWN_CAP_MS ? "ended" : "winddown";
  }
  return "live";
}
