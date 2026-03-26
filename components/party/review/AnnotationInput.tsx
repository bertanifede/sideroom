"use client";

import { useState, useRef } from "react";

interface AnnotationInputProps {
  timestampSec: number;
  onSubmit: (text: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AnnotationInput({
  timestampSec,
  onSubmit,
}: AnnotationInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (trimmed.length > 0 && trimmed.length <= 280) {
      onSubmit(trimmed);
      setText("");
    }
  };

  return (
    <div className="flex items-center gap-2 bg-[var(--party-surface)] border border-[var(--party-fg)]/10 rounded-lg px-3 py-2">
      <span className="text-xs font-mono opacity-50 shrink-0">
        {formatTime(timestampSec)}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 280))}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
        placeholder="Add a note..."
        className="flex-1 bg-transparent text-sm text-[var(--party-fg)] placeholder:text-[var(--party-fg)]/30 outline-none"
      />
      <span className="text-[10px] opacity-30 shrink-0">{text.length}/280</span>
      <button
        onClick={handleSubmit}
        disabled={!text.trim()}
        className="text-xs px-2 py-1 rounded bg-[var(--party-accent)] text-[var(--party-bg)] disabled:opacity-30"
      >
        Add
      </button>
    </div>
  );
}
