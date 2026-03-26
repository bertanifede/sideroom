"use client";

import { useState, useEffect, useCallback } from "react";
import { Party, Track, TrackAnnotation, PartyTheme } from "@/types";
import TrackReviewCard from "./TrackReviewCard";

interface PostPartyReviewProps {
  party: Party;
  tracks: Track[];
  isHost: boolean;
  coverImageUrl: string | null;
  theme: PartyTheme;
}

export default function PostPartyReview({
  party,
  tracks,
  isHost,
  coverImageUrl,
  theme,
}: PostPartyReviewProps) {
  const [annotations, setAnnotations] = useState<TrackAnnotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/party/${party.id}/annotations`);
        if (res.ok) {
          const data = await res.json();
          setAnnotations(data);
        }
      } catch {
        // Annotations failed to load — non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [party.id]);

  const handleAnnotationCreated = useCallback((annotation: TrackAnnotation) => {
    setAnnotations((prev) =>
      [...prev, annotation].sort((a, b) => a.timestamp_sec - b.timestamp_sec)
    );
  }, []);

  const handleAnnotationDeleted = useCallback((annotationId: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
  }, []);

  const handleAnnotationEdited = useCallback((annotationId: string, newText: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === annotationId ? { ...a, text: newText } : a))
    );
  }, []);

  return (
    <div
      className="min-h-screen text-[var(--party-fg)]"
      style={{
        "--party-bg": theme.bg,
        "--party-fg": theme.fg,
        "--party-accent": theme.accent,
        "--party-surface": theme.surface,
        backgroundColor: theme.bg,
        color: theme.fg,
        fontFamily: theme.font || undefined,
      } as React.CSSProperties}
    >
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt={`${party.title} cover`}
              className="w-24 h-24 rounded-lg object-cover mx-auto mb-4"
            />
          )}
          <h1 className="text-xl font-bold">{party.title}</h1>
          <p className="text-sm opacity-50 mt-1">
            {isHost ? "Review annotations from your listeners" : "Add notes to the tracks"}
          </p>
        </div>

        {/* Track list with waveforms */}
        {loading ? (
          <p className="text-center text-sm opacity-30">Loading...</p>
        ) : (
          <div className="space-y-4">
            {tracks.map((track) => (
              <TrackReviewCard
                key={track.id}
                track={track}
                partyId={party.id}
                annotations={annotations}
                theme={theme}
                showAuthor={isHost}
                onAnnotationCreated={handleAnnotationCreated}
                onAnnotationDeleted={handleAnnotationDeleted}
                onAnnotationEdited={handleAnnotationEdited}
              />
            ))}
          </div>
        )}

        {/* Back link */}
        <div className="text-center mt-8">
          <a
            href={isHost ? "/dashboard" : "/"}
            className="text-sm opacity-50 hover:opacity-80 transition-opacity"
          >
            {isHost ? "\u2190 Back to Dashboard" : "\u2190 Back to Home"}
          </a>
        </div>
      </div>
    </div>
  );
}
