"use client";

import { useState, useCallback } from "react";

interface LiveNoteButtonProps {
  partyId: string;
  trackId: string | null;
  currentTime: number;
}

export default function LiveNoteButton({
  partyId,
  trackId,
  currentTime,
}: LiveNoteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [noteCount, setNoteCount] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!text.trim() || !trackId) return;

    // Optimistic — show confirmation immediately, fire request in background
    const body = {
      track_id: trackId,
      timestamp_sec: currentTime,
      text: text.trim(),
      is_live_reaction: true,
    };

    setText("");
    setIsOpen(false);
    setNoteCount((c) => c + 1);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);

    fetch(`/api/party/${partyId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [text, trackId, partyId, currentTime]);

  if (showConfirmation) {
    return (
      <span className="text-xs px-3 py-1.5 text-[var(--party-accent)]">
        Note added!
      </span>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs px-3 py-1.5 rounded-full bg-[var(--party-fg)]/10 text-[var(--party-fg)]/60 hover:text-[var(--party-fg)]/80 transition-colors"
      >
        + Add Note{noteCount > 0 ? ` (${noteCount})` : ""}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 280))}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") { setIsOpen(false); setText(""); }
        }}
        placeholder="Note at this moment..."
        autoFocus
        className="flex-1 bg-[var(--party-fg)]/5 border border-[var(--party-fg)]/10 rounded-full px-3 py-1.5 text-base md:text-xs text-[var(--party-fg)] placeholder:text-[var(--party-fg)]/30 outline-none"
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim()}
        className="text-xs px-3 py-1.5 rounded-full bg-[var(--party-accent)] text-[var(--party-bg)] disabled:opacity-30"
      >
        Send
      </button>
    </div>
  );
}
