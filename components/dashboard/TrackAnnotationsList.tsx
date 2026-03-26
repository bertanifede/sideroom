"use client";

import { TrackAnnotation, Track } from "@/types";

interface TrackAnnotationsListProps {
  annotations: TrackAnnotation[];
  tracks: Track[];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TrackAnnotationsList({ annotations, tracks }: TrackAnnotationsListProps) {
  if (annotations.length === 0) {
    return <p className="text-text-tertiary text-sm">No track annotations yet.</p>;
  }

  // Group by track
  const byTrack = new Map<string, TrackAnnotation[]>();
  for (const ann of annotations) {
    const list = byTrack.get(ann.track_id) || [];
    list.push(ann);
    byTrack.set(ann.track_id, list);
  }

  return (
    <div className="space-y-6">
      {tracks.map((track) => {
        const trackAnns = byTrack.get(track.id);
        if (!trackAnns || trackAnns.length === 0) return null;

        const sorted = [...trackAnns].sort((a, b) => a.timestamp_sec - b.timestamp_sec);

        return (
          <div key={track.id}>
            <h3 className="text-sm font-medium text-text-secondary mb-2">
              {track.file_name}
              <span className="text-text-tertiary ml-2">Track {track.position}</span>
            </h3>
            <div className="space-y-2">
              {sorted.map((ann) => (
                <div
                  key={ann.id}
                  className="bg-surface border border-surface-border rounded-lg px-4 py-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-tertiary">
                        {formatTime(ann.timestamp_sec)}
                      </span>
                      <span className="text-sm font-medium text-text-primary">
                        {ann.author_name}
                      </span>
                      {ann.is_live_reaction && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-hover text-text-tertiary">
                          live
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-tertiary">
                      {new Date(ann.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{ann.text}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
