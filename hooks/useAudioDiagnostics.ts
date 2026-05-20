"use client";

import { useEffect, RefObject } from "react";
import { diag } from "@/lib/diagnostics";

/** Debug-only: logs audio-element buffering events and measures stall durations. */
export function useAudioDiagnostics(
  audioRef: RefObject<HTMLAudioElement | null>,
  swapCount: number
): void {
  useEffect(() => {
    if (!diag.enabled) return;
    const audio = audioRef.current;
    if (!audio) return;

    let waitingAt = 0;
    const at = () => Number(audio.currentTime.toFixed(2));

    const onWaiting = () => {
      waitingAt = performance.now();
      diag.log("audio", "waiting", { t: at(), readyState: audio.readyState });
    };
    const onPlaying = () => {
      if (waitingAt > 0) {
        const stallMs = performance.now() - waitingAt;
        diag.recordStall(stallMs);
        diag.log("audio", "recovered", { stallMs: Math.round(stallMs) });
        waitingAt = 0;
      }
    };
    const onStalled = () => diag.log("audio", "stalled", { t: at() });
    const onSeeking = () => diag.log("audio", "seeking", { t: at() });
    const onSeeked = () => diag.log("audio", "seeked", { t: at() });
    const onRateChange = () => diag.log("audio", "ratechange", { rate: audio.playbackRate });
    const onError = () => diag.log("audio", "error", { code: audio.error?.code });

    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("stalled", onStalled);
    audio.addEventListener("seeking", onSeeking);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("ratechange", onRateChange);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("stalled", onStalled);
      audio.removeEventListener("seeking", onSeeking);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("ratechange", onRateChange);
      audio.removeEventListener("error", onError);
    };
  }, [audioRef, swapCount]);
}
