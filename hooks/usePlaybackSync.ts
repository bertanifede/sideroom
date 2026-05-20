"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { PlaybackEvent, PlaybackState, Track } from "@/types";

/** Pure function: compute where to seek given persisted state + elapsed time */
export function computeSeekPosition(
  position: number,
  updatedAt: string,
  trackDuration: number | null | undefined
): number {
  const rawElapsed = (Date.now() - new Date(updatedAt).getTime()) / 1000;
  const elapsed = Math.min(rawElapsed, 30);
  return trackDuration
    ? Math.min(position + elapsed, trackDuration)
    : position + elapsed;
}

/** Sync correction tuning — see spec P0b. */
const SYNC_DEAD_ZONE_SEC = 2;
const SYNC_SEEK_THRESHOLD_SEC = 5;
const NUDGE_RATE_FASTER = 1.03;
const NUDGE_RATE_SLOWER = 0.97;

/**
 * Pure decision for guest drift correction.
 * `delta` = artist position − guest position (positive ⇒ guest is behind).
 */
export function decideCorrection(delta: number): {
  action: "none" | "nudge" | "seek";
  playbackRate: number;
} {
  const magnitude = Math.abs(delta);
  if (magnitude <= SYNC_DEAD_ZONE_SEC) {
    return { action: "none", playbackRate: 1 };
  }
  if (magnitude <= SYNC_SEEK_THRESHOLD_SEC) {
    return {
      action: "nudge",
      playbackRate: delta > 0 ? NUDGE_RATE_FASTER : NUDGE_RATE_SLOWER,
    };
  }
  return { action: "seek", playbackRate: 1 };
}

interface UsePlaybackSyncProps {
  channel: RealtimeChannel | null;
  isArtist: boolean;
  tracks: Track[];
  partyId: string;
  initialPlaybackState?: PlaybackState | null;
  isConnected?: boolean;
}

export function usePlaybackSync({
  channel,
  isArtist,
  tracks,
  partyId,
  initialPlaybackState,
  isConnected = false,
}: UsePlaybackSyncProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedTrackRef = useRef<number | null>(null);
  const [swapCount, setSwapCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTrackPosition, setCurrentTrackPosition] = useState(1);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const persistTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recoveryAttemptedRef = useRef(false);
  const recoveryCompleteRef = useRef(false);
  const currentTrackPositionRef = useRef(currentTrackPosition);

  const totalTracks = tracks.length;
  const currentTrack = tracks.find((t) => t.position === currentTrackPosition) ?? null;

  // Broadcast playback event (artist only)
  const broadcast = useCallback(
    (event: PlaybackEvent) => {
      if (!channel) return;
      channel.send({
        type: "broadcast",
        event: "playback",
        payload: event,
      });
    },
    [channel]
  );

  // Persist playback state to DB (artist only, debounced fire-and-forget)
  const persistState = useCallback(
    (trackPos: number, position: number, playing: boolean) => {
      if (!isArtist) return;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        fetch(`/api/party/${partyId}/playback-state`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            track_position: trackPos,
            position,
            is_playing: playing,
          }),
        }).catch(() => {});
      }, 300);
    },
    [isArtist, partyId]
  );

  // Build proxy URL for a track position (sync — no fetch needed)
  const getStreamProxyUrl = useCallback(
    (trackPosition: number): string => {
      return `/api/party/${partyId}/stream?track=${trackPosition}`;
    },
    [partyId]
  );

  useEffect(() => {
    currentTrackPositionRef.current = currentTrackPosition;
  }, [currentTrackPosition]);

  // Play a specific track
  const playTrack = useCallback(
    async (trackPosition: number) => {
      const active = audioRef.current;
      const preload = preloadAudioRef.current;
      if (!active) return;

      // Check if preload element already has this track buffered
      if (
        preload &&
        preloadedTrackRef.current === trackPosition &&
        preload.readyState >= 2 // HAVE_CURRENT_DATA or better
      ) {
        // Swap: preloaded becomes active, old active becomes preloader
        const oldActive = active;

        // Swap the ref contents
        audioRef.current = preload;
        preloadAudioRef.current = oldActive;

        // Play the now-active element
        setCurrentTrackPosition(trackPosition);
        const url = getStreamProxyUrl(trackPosition);
        setAudioUrl(url);

        await preload.play();
        setIsPlaying(true);

        // Clean up old active
        oldActive.pause();
        oldActive.removeAttribute("src");
        oldActive.load(); // reset the element
        preloadedTrackRef.current = null;

        // Signal swap so effects re-attach listeners
        setSwapCount((c) => c + 1);
      } else {
        // Cold load: no preloaded data available (fallback to current behavior)
        const url = getStreamProxyUrl(trackPosition);
        active.src = url;
        setAudioUrl(url);
        setCurrentTrackPosition(trackPosition);
        preloadedTrackRef.current = null;

        await active.play();
        setIsPlaying(true);
      }

      broadcast({
        type: "PLAY",
        position: 0,
        track_position: trackPosition,
      });

      persistState(trackPosition, 0, true);
    },
    [broadcast, getStreamProxyUrl, persistState]
  );

  // Artist controls
  const play = useCallback(
    async (streamUrl?: string) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (streamUrl) {
        if (!audio.src || audio.src !== streamUrl) {
          audio.src = streamUrl;
          setAudioUrl(streamUrl);
        }
        await audio.play();
        setIsPlaying(true);
        broadcast({
          type: "PLAY",
          position: audio.currentTime,
          track_position: currentTrackPosition,
        });
        persistState(currentTrackPosition, audio.currentTime, true);
      } else {
        // Resume current track or start track 1
        if (audio.src) {
          await audio.play();
          setIsPlaying(true);
          broadcast({
            type: "PLAY",
            position: audio.currentTime,
            track_position: currentTrackPosition,
          });
          persistState(currentTrackPosition, audio.currentTime, true);
        } else {
          await playTrack(1);
        }
      }
    },
    [broadcast, audioUrl, currentTrackPosition, playTrack, persistState]
  );

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);

    broadcast({ type: "PAUSE", position: audio.currentTime });
    persistState(currentTrackPosition, audio.currentTime, false);
  }, [broadcast, currentTrackPosition, persistState]);

  const seek = useCallback(
    (position: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      audio.currentTime = position;
      setCurrentTime(position);

      broadcast({ type: "SEEK", position });
      persistState(currentTrackPosition, position, !audio.paused);
    },
    [broadcast, currentTrackPosition, persistState]
  );

  const nextTrack = useCallback(async () => {
    if (currentTrackPosition < totalTracks) {
      await playTrack(currentTrackPosition + 1);
    }
  }, [currentTrackPosition, totalTracks, playTrack]);

  const prevTrack = useCallback(async () => {
    if (currentTrackPosition > 1) {
      await playTrack(currentTrackPosition - 1);
    }
  }, [currentTrackPosition, playTrack]);

  // Artist heartbeat — broadcast position every 5s + persist to DB
  useEffect(() => {
    if (!isArtist || !isPlaying || !channel) return;

    heartbeatRef.current = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;

      broadcast({ type: "HEARTBEAT", position: audio.currentTime, track_position: currentTrackPosition, is_playing: true });
      persistState(currentTrackPosition, audio.currentTime, true);
    }, 5000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [isArtist, isPlaying, channel, broadcast, currentTrackPosition, persistState]);

  // Guest: listen for playback events
  useEffect(() => {
    if (!channel || isArtist) return;

    const handlePlayback = async (payload: { payload: PlaybackEvent }) => {
      const event = payload.payload;
      const audio = audioRef.current;
      if (!audio) return;

      // Ignore broadcasts while initial recovery is still in progress
      if (!recoveryCompleteRef.current) return;

      switch (event.type) {
        case "PLAY": {
          const trackPos = event.track_position;
          const preload = preloadAudioRef.current;

          // Try preloaded element first
          if (
            preload &&
            preloadedTrackRef.current === trackPos &&
            preload.readyState >= 2
          ) {
            const oldActive = audio;
            audioRef.current = preload;
            preloadAudioRef.current = oldActive;

            setCurrentTrackPosition(trackPos);
            preload.currentTime = event.position;

            try {
              await preload.play();
              setIsPlaying(true);
              setNeedsInteraction(false);
            } catch {
              setNeedsInteraction(true);
            }

            oldActive.pause();
            oldActive.removeAttribute("src");
            oldActive.load();
            preloadedTrackRef.current = null;
            setSwapCount((c) => c + 1);
          } else {
            // Cold load fallback (existing behavior)
            const url = getStreamProxyUrl(trackPos);
            setCurrentTrackPosition(trackPos);

            if (!audio.src || !audio.src.endsWith(`/stream?track=${trackPos}`)) {
              audio.src = url;
              setAudioUrl(url);
            }
            audio.currentTime = event.position;
            setTimeout(() => {
              audio.play().then(() => {
                setIsPlaying(true);
                setNeedsInteraction(false);
              }).catch(() => {
                setNeedsInteraction(true);
              });
            }, 200);
          }
          break;
        }
        case "PAUSE": {
          audio.pause();
          audio.currentTime = event.position;
          setIsPlaying(false);
          break;
        }
        case "SEEK": {
          audio.currentTime = event.position;
          setCurrentTime(event.position);
          break;
        }
        case "HEARTBEAT": {
          // Track change recovery: if artist is on a different track, switch
          if (event.track_position && event.track_position !== currentTrackPositionRef.current) {
            const preload = preloadAudioRef.current;

            if (
              preload &&
              preloadedTrackRef.current === event.track_position &&
              preload.readyState >= 2
            ) {
              const oldActive = audio;
              audioRef.current = preload;
              preloadAudioRef.current = oldActive;

              setCurrentTrackPosition(event.track_position);
              preload.currentTime = event.position;

              try {
                await preload.play();
                setIsPlaying(true);
              } catch {
                setNeedsInteraction(true);
              }

              oldActive.pause();
              oldActive.removeAttribute("src");
              oldActive.load();
              preloadedTrackRef.current = null;
              setSwapCount((c) => c + 1);
            } else {
              // Cold load fallback (existing behavior)
              const url = getStreamProxyUrl(event.track_position);
              setCurrentTrackPosition(event.track_position);
              audio.src = url;
              setAudioUrl(url);
              audio.currentTime = event.position;
              try {
                await audio.play();
                setIsPlaying(true);
              } catch {
                setNeedsInteraction(true);
              }
            }
            break;
          }

          // If artist says playing but we're paused, resume
          if (event.is_playing && audio.paused) {
            try {
              await audio.play();
              setIsPlaying(true);
            } catch {
              setNeedsInteraction(true);
            }
          }

          const drift = Math.abs(audio.currentTime - event.position);
          if (drift > 2) {
            audio.currentTime = event.position;
          } else if (drift > 0.3) {
            audio.currentTime = event.position;
          }
          break;
        }
      }
    };

    channel.on("broadcast", { event: "playback" }, handlePlayback);

    const handlePartyEnded = () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        setIsPlaying(false);
      }
      setPartyEnded(true);
    };
    channel.on("broadcast", { event: "party_ended" }, handlePartyEnded);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel as any).off?.("broadcast", { event: "playback" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel as any).off?.("broadcast", { event: "party_ended" });
    };
  }, [channel, isArtist, getStreamProxyUrl]);

  // Guest recovery: restore playback from persisted state on mount
  useEffect(() => {
    if (isArtist) {
      recoveryCompleteRef.current = true;
      return;
    }
    if (recoveryAttemptedRef.current) return;
    recoveryAttemptedRef.current = true;

    if (!initialPlaybackState) {
      recoveryCompleteRef.current = true;
      return;
    }

    const state = initialPlaybackState;
    setCurrentTrackPosition(state.track_position);

    if (!state.is_playing) {
      recoveryCompleteRef.current = true;
      return;
    }

    const trackDuration = tracks.find((t) => t.position === state.track_position)?.duration;
    const seekTo = computeSeekPosition(state.position, state.updated_at, trackDuration);

    const audio = audioRef.current;
    if (!audio) {
      recoveryCompleteRef.current = true;
      return;
    }

    const url = getStreamProxyUrl(state.track_position);
    audio.src = url;
    setAudioUrl(url);
    audio.currentTime = seekTo;

    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setNeedsInteraction(true);
    }).finally(() => {
      recoveryCompleteRef.current = true;
    });
  }, [isArtist, initialPlaybackState, getStreamProxyUrl]);

  // Guest reconnection recovery: re-sync from DB when channel reconnects
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    const wasConnected = prevConnectedRef.current;
    prevConnectedRef.current = isConnected;

    // Only trigger on reconnection (false→true), after initial recovery
    if (!isConnected || wasConnected || !recoveryCompleteRef.current || isArtist) return;
    // Skip the very first connection (handled by mount recovery)
    if (!wasConnected && !recoveryAttemptedRef.current) return;

    (async () => {
      try {
        const res = await fetch(`/api/party/${partyId}/playback-state`);
        if (!res.ok) return;
        const { playback_state } = await res.json();
        if (!playback_state) return;

        const state = playback_state as PlaybackState;
        const audio = audioRef.current;
        if (!audio) return;

        setCurrentTrackPosition(state.track_position);

        if (!state.is_playing) {
          audio.pause();
          setIsPlaying(false);
          return;
        }

        const trackDur = tracks.find((t) => t.position === state.track_position)?.duration;
        const seekTo = computeSeekPosition(state.position, state.updated_at, trackDur);

        // Switch track if needed
        if (state.track_position !== currentTrackPositionRef.current || !audio.src) {
          const url = getStreamProxyUrl(state.track_position);
          audio.src = url;
          setAudioUrl(url);
        }

        audio.currentTime = seekTo;
        try {
          await audio.play();
          setIsPlaying(true);
        } catch {
          setNeedsInteraction(true);
        }
      } catch {
        // Network still down, next reconnection will retry
      }
    })();
  }, [isConnected, isArtist, partyId, tracks, getStreamProxyUrl]);

  // Track time updates + auto-advance on ended
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      // Preload next track when approaching end (15s remaining)
      if (
        audio.duration &&
        audio.duration - audio.currentTime < 15 &&
        audio.duration - audio.currentTime > 0 &&
        currentTrackPositionRef.current < totalTracks
      ) {
        const nextPos = currentTrackPositionRef.current + 1;
        const preload = preloadAudioRef.current;
        if (preload && preloadedTrackRef.current !== nextPos) {
          preload.src = getStreamProxyUrl(nextPos);
          preloadedTrackRef.current = nextPos;
        }
      }
    };
    const onDurationChange = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      persistState(currentTrackPosition, 0, false);
      if (isArtist) {
        if (currentTrackPosition < totalTracks) {
          // Auto-advance to next track
          playTrack(currentTrackPosition + 1);
        } else {
          // Last track finished — end the party
          endPartyRef.current();
        }
      }
    };

    // Re-set proxy URL on error (proxy generates fresh signed URL each request)
    const onError = async () => {
      if (!audio.src) return;
      const savedTime = audio.currentTime;
      const wasPlaying = !audio.paused;

      const url = getStreamProxyUrl(currentTrackPositionRef.current);
      audio.src = url;
      setAudioUrl(url);
      audio.currentTime = savedTime;

      if (wasPlaying) {
        try {
          await audio.play();
          setIsPlaying(true);
        } catch {
          setNeedsInteraction(true);
        }
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [isArtist, currentTrackPosition, totalTracks, playTrack, persistState, getStreamProxyUrl, swapCount]);

  // End the party (artist only) — sets ended_at and broadcasts to guests
  const [partyEnded, setPartyEnded] = useState(false);
  const endParty = useCallback(async () => {
    if (!isArtist || partyEnded) return;

    // Stop audio
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }

    // Broadcast end to guests
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "party_ended",
        payload: {},
      });
    }

    // Persist to DB
    await fetch(`/api/party/${partyId}/end`, { method: "POST" }).catch(() => {});
    setPartyEnded(true);
  }, [isArtist, partyEnded, channel, partyId]);

  const endPartyRef = useRef(endParty);
  useEffect(() => {
    endPartyRef.current = endParty;
  });

  const resumeFromInteraction = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // If src was never set (recovery bailed before setting it), set proxy URL now
    if (!audio.src) {
      const url = getStreamProxyUrl(currentTrackPositionRef.current);
      audio.src = url;
      setAudioUrl(url);
    }

    try {
      await audio.play();
      setIsPlaying(true);
      setNeedsInteraction(false);
    } catch {
      // Still blocked — user will need to tap again
    }
  }, [getStreamProxyUrl]);

  return {
    audioRef,
    preloadAudioRef,
    swapCount,
    isPlaying,
    currentTime,
    duration,
    audioUrl,
    currentTrack,
    currentTrackPosition,
    totalTracks,
    needsInteraction,
    play,
    pause,
    seek,
    nextTrack,
    prevTrack,
    playTrack,
    resumeFromInteraction,
    partyEnded,
    endParty,
  };
}
