"use client";

import { useState, useRef } from "react";

const EMOJI_OPTIONS = [
  "🔥", "❤️", "🎶", "🙌", "💯", "✨", "🎧", "🤯",
  "😍", "👏", "💜", "🫶", "😭", "🥹", "💿", "🎵",
  "🫡", "😮‍💨", "🤝", "💀", "🥳", "🤩", "😈", "👀",
  "💎", "🌟", "🎤", "🎸", "🥁", "🎹", "🪩", "🕺",
  "💃", "🙏", "👑", "⚡", "🌊", "🍾", "🫠", "❤️‍🔥",
  "🤮", "💩", "👎", "😬", "🙄", "😴", "🗑️", "😐",
];

interface PartyEndedOverlayProps {
  partyId: string;
  isArtist: boolean;
  guestName: string;
}

export default function PartyEndedOverlay({
  partyId,
  isArtist,
}: PartyEndedOverlayProps) {
  const [message, setMessage] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">(
    "idle"
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessage((prev) => prev + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = message.slice(0, start) + emoji + message.slice(end);
    if (next.length <= 1000) {
      setMessage(next);
      requestAnimationFrame(() => {
        const pos = start + emoji.length;
        textarea.selectionStart = pos;
        textarea.selectionEnd = pos;
        textarea.focus();
      });
    }
  }

  async function handleSubmit() {
    if (!message.trim()) return;
    setState("submitting");
    try {
      const res = await fetch(`/api/party/${partyId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (!res.ok) throw new Error();
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="text-center px-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-text-primary mb-6">Party Ended</h2>

        {isArtist ? (
          <a
            href={`/dashboard?ended=${partyId}`}
            className="inline-block px-5 py-2.5 bg-surface border border-surface-border text-text-primary text-sm font-medium rounded-full hover:bg-surface-hover transition-colors"
          >
            Back to Dashboard
          </a>
        ) : state === "idle" || state === "error" ? (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Leave a note for the artist..."
                className="w-full bg-surface-inset border border-surface-border rounded-lg px-4 py-3 text-text-primary text-sm placeholder:text-text-tertiary resize-none focus:outline-none focus:border-text-tertiary"
              />
              <button
                type="button"
                onClick={() => setShowEmojis((v) => !v)}
                className="absolute bottom-3 right-3 text-lg hover:scale-110 transition-transform"
                title="Add emoji"
              >
                😊
              </button>
            </div>

            {showEmojis && (
              <div className="flex flex-wrap gap-1.5 justify-center bg-surface-inset border border-surface-border rounded-lg p-3">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="text-xl w-9 h-9 flex items-center justify-center rounded-md hover:bg-surface-hover transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-text-tertiary">
                {message.length}/1000
              </span>
              {state === "error" && (
                <span className="text-xs text-destructive">
                  Failed to send. Try again.
                </span>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 text-text-secondary text-sm font-medium hover:text-text-primary transition-colors"
              >
                Skip & Review Tracks
              </button>
              <button
                onClick={handleSubmit}
                disabled={!message.trim()}
                className="px-5 py-2.5 bg-surface border border-surface-border text-text-primary text-sm font-medium rounded-full hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send Note
              </button>
            </div>
          </div>
        ) : state === "submitting" ? (
          <p className="text-text-secondary text-sm">Sending...</p>
        ) : (
          <div className="space-y-4">
            <p className="text-text-secondary text-sm">
              Your note has been sent. Thank you!
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-block px-5 py-2.5 bg-surface border border-surface-border text-text-primary text-sm font-medium rounded-full hover:bg-surface-hover transition-colors"
            >
              Review Tracks &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
