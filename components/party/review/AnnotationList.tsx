"use client";

import { useState } from "react";
import { TrackAnnotation } from "@/types";

interface AnnotationListProps {
  annotations: TrackAnnotation[];
  onClickAnnotation: (timestampSec: number) => void;
  onDelete?: (annotationId: string) => void;
  onEdit?: (annotationId: string, newText: string) => void;
  showAuthor: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AnnotationList({
  annotations,
  onClickAnnotation,
  onDelete,
  onEdit,
  showAuthor,
}: AnnotationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  if (annotations.length === 0) {
    return <p className="text-xs opacity-30 py-2">No notes yet</p>;
  }

  const startEdit = (ann: TrackAnnotation) => {
    setEditingId(ann.id);
    setEditText(ann.text);
  };

  const submitEdit = (annotationId: string) => {
    const trimmed = editText.trim();
    if (trimmed && trimmed.length <= 280 && onEdit) {
      onEdit(annotationId, trimmed);
    }
    setEditingId(null);
    setEditText("");
  };

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {annotations.map((ann) => (
        <div
          key={ann.id}
          className="group w-full flex items-start gap-2 text-left px-2 py-1.5 rounded hover:bg-[var(--party-fg)]/5 transition-colors"
        >
          <button
            onClick={() => onClickAnnotation(ann.timestamp_sec)}
            className="text-xs font-mono opacity-50 shrink-0 pt-0.5 hover:opacity-80"
          >
            {formatTime(ann.timestamp_sec)}
          </button>
          <div className="flex-1 min-w-0">
            {showAuthor && (
              <span className="text-[10px] font-medium opacity-60">
                {ann.author_name}
                {ann.is_live_reaction ? " · live" : ""}
              </span>
            )}
            {editingId === ann.id ? (
              <div className="flex items-center gap-1 mt-0.5">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value.slice(0, 280))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitEdit(ann.id);
                    if (e.key === "Escape") { setEditingId(null); setEditText(""); }
                  }}
                  autoFocus
                  className="flex-1 bg-[var(--party-fg)]/5 border border-[var(--party-fg)]/10 rounded px-2 py-0.5 text-sm text-[var(--party-fg)] outline-none"
                />
                <button
                  onClick={() => submitEdit(ann.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--party-accent)] text-[var(--party-bg)]"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="text-sm leading-snug break-words">{ann.text}</p>
            )}
          </div>
          {!showAuthor && editingId !== ann.id && (onEdit || onDelete) && (
            <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-50 transition-opacity">
              {onEdit && (
                <button
                  onClick={() => startEdit(ann)}
                  className="text-[10px] hover:opacity-100"
                  title="Edit"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(ann.id)}
                  className="text-[10px] hover:opacity-100 text-red-400"
                  title="Delete"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
