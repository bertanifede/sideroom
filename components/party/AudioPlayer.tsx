"use client";

import { RefObject, useEffect, useState } from "react";

interface AudioPlayerProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  preloadAudioRef?: RefObject<HTMLAudioElement | null>;
  swapCount?: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isArtist: boolean;
  onPlay: () => void;
  onPause: () => void;
  trackName?: string | null;
  currentTrackPosition?: number;
  totalTracks?: number;
  needsInteraction?: boolean;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({
  audioRef,
  preloadAudioRef,
  swapCount,
  isPlaying,
  currentTime,
  duration,
  isArtist,
  onPlay,
  onPause,
  trackName,
  currentTrackPosition,
  totalTracks,
  needsInteraction,
}: AudioPlayerProps) {
  // Keep pitch stable when playbackRate is nudged for sync correction.
  useEffect(() => {
    for (const ref of [audioRef, preloadAudioRef]) {
      const el = ref?.current;
      if (!el) continue;
      el.preservesPitch = true;
      (el as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
    }
  }, [audioRef, preloadAudioRef]);

  const [isBuffering, setIsBuffering] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onWaiting = () => setIsBuffering(true);
    const onResumed = () => setIsBuffering(false);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onResumed);
    audio.addEventListener("canplay", onResumed);
    return () => {
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onResumed);
      audio.removeEventListener("canplay", onResumed);
    };
  }, [audioRef, swapCount]);

  const hasMultipleTracks = (totalTracks ?? 0) > 1;

  return (
    <div className="w-full" onContextMenu={(e) => e.preventDefault()}>
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />
      <audio ref={preloadAudioRef} preload="auto" crossOrigin="anonymous" />

      {/* Current track info */}
      {trackName && (
        <div className="mb-4">
          <p className="text-xs text-[var(--party-fg)]/40 font-mono truncate">{trackName}</p>
          {hasMultipleTracks && (
            <p className="text-xs text-[var(--party-fg)]/30 font-mono mt-0.5">
              Track {currentTrackPosition} of {totalTracks}
            </p>
          )}
        </div>
      )}

      {/* Time display — only shown when playing */}
      {isPlaying && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--party-fg)]/50">{formatTime(currentTime)}</span>
          <span className="text-xs text-[var(--party-fg)]/50">{formatTime(duration)}</span>
        </div>
      )}

      {/* Guest: listening indicator */}
      {!isArtist && isPlaying && !needsInteraction && !isBuffering && (
        <div className="flex items-center justify-center mt-4 gap-1">
          <div className="w-1 h-3 bg-[var(--party-fg)] rounded-full animate-pulse" />
          <div className="w-1 h-4 bg-[var(--party-fg)] rounded-full animate-pulse delay-75" />
          <div className="w-1 h-2 bg-[var(--party-fg)] rounded-full animate-pulse delay-150" />
          <span className="text-xs text-[var(--party-fg)]/60 ml-2">Listening</span>
        </div>
      )}

      {/* Buffering indicator */}
      {isPlaying && isBuffering && (
        <div className="flex items-center justify-center mt-4 gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-[var(--party-fg)]/30 border-t-[var(--party-fg)] animate-spin" />
          <span className="text-xs text-[var(--party-fg)]/60">Buffering…</span>
        </div>
      )}
    </div>
  );
}
