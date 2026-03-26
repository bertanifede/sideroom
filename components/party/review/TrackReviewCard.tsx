"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Track, TrackAnnotation, PartyTheme } from "@/types";
import { useWaveformData } from "@/hooks/useWaveformData";
import WaveformDisplay from "./WaveformDisplay";
import AnnotationInput from "./AnnotationInput";
import AnnotationList from "./AnnotationList";

interface TrackReviewCardProps {
  track: Track;
  partyId: string;
  annotations: TrackAnnotation[];
  theme: PartyTheme;
  showAuthor: boolean;
  onAnnotationCreated: (annotation: TrackAnnotation) => void;
  onAnnotationDeleted: (annotationId: string) => void;
  onAnnotationEdited: (annotationId: string, newText: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TrackReviewCard({
  track,
  partyId,
  annotations,
  theme,
  showAuthor,
  onAnnotationCreated,
  onAnnotationDeleted,
  onAnnotationEdited,
}: TrackReviewCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(track.duration || 0);
  const streamUrl = `/api/party/${partyId}/stream?track=${track.position}`;
  const { bars, isLoading: waveformLoading } = useWaveformData(streamUrl);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = streamUrl;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, [streamUrl]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const seek = useCallback((timestampSec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = timestampSec;
    setCurrentTime(timestampSec);
  }, []);

  const submitAnnotation = useCallback(
    async (text: string) => {
      const timestampSec = currentTime;

      const res = await fetch(`/api/party/${partyId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track_id: track.id,
          timestamp_sec: timestampSec,
          text,
          is_live_reaction: false,
        }),
      });

      if (res.ok) {
        // Optimistically add to list
        const newAnnotation: TrackAnnotation = {
          id: crypto.randomUUID(),
          party_id: partyId,
          track_id: track.id,
          seat_id: null,
          author_name: "",
          timestamp_sec: timestampSec,
          text,
          is_live_reaction: false,
          created_at: new Date().toISOString(),
        };
        onAnnotationCreated(newAnnotation);
      }
    },
    [currentTime, partyId, track.id, onAnnotationCreated]
  );

  const deleteAnnotation = useCallback(
    async (annotationId: string) => {
      await fetch(`/api/party/${partyId}/annotations?annotationId=${annotationId}`, {
        method: "DELETE",
      });
      onAnnotationDeleted(annotationId);
    },
    [partyId, onAnnotationDeleted]
  );

  const editAnnotation = useCallback(
    async (annotationId: string, newText: string) => {
      await fetch(`/api/party/${partyId}/annotations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotationId, text: newText }),
      });
      onAnnotationEdited(annotationId, newText);
    },
    [partyId, onAnnotationEdited]
  );

  const trackAnnotations = annotations.filter((a) => a.track_id === track.id);

  return (
    <div className="bg-[var(--party-surface)]/30 rounded-xl p-4 space-y-3">
      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" />

      {/* Track header */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-[var(--party-accent)] text-[var(--party-bg)] flex items-center justify-center"
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="2" />
                <rect x="14" y="4" width="4" height="16" rx="2" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" />
              </svg>
            )}
          </button>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">{track.file_name}</p>
          <p className="text-xs opacity-40">
            Track {track.position} · {formatTime(duration)}
          </p>
        </div>
        <span className="text-xs font-mono opacity-50">
          {formatTime(currentTime)}
        </span>
      </div>

      {/* Waveform */}
      {waveformLoading ? (
        <div className="w-full h-20 flex items-center justify-center">
          <p className="text-xs opacity-30">Loading waveform...</p>
        </div>
      ) : (
        <WaveformDisplay
          bars={bars}
          duration={duration}
          currentTime={currentTime}
          annotations={trackAnnotations}
          accentColor={theme.accent}
          surfaceColor={theme.surface}
          fgColor={theme.fg}
          onSeek={seek}
        />
      )}

      {/* Annotation input */}
      <AnnotationInput
        timestampSec={currentTime}
        onSubmit={submitAnnotation}
      />

      {/* Annotation list */}
      <AnnotationList
        annotations={trackAnnotations}
        onClickAnnotation={seek}
        showAuthor={showAuthor}
        onDelete={deleteAnnotation}
        onEdit={editAnnotation}
      />
    </div>
  );
}
