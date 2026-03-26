"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface CountdownOverlayProps {
  scheduledAt: string;
}

function getTimeLeft(scheduledAt: string) {
  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, total: diff };
}

export default function CountdownOverlay({ scheduledAt }: CountdownOverlayProps) {
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(scheduledAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeLeft(scheduledAt);
      setTimeLeft(remaining);
      if (!remaining) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [scheduledAt]);

  // Don't show if party already started or user dismissed
  if (!timeLeft || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative flex flex-col items-center gap-6 px-8 py-10 max-w-sm w-full mx-4">
        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center
                     rounded-full hover:bg-surface-hover transition-colors"
        >
          <X className="w-4 h-4 text-text-tertiary" />
        </button>

        <p className="text-sm text-text-secondary uppercase tracking-widest">Party starts in</p>

        {/* Countdown digits */}
        <div className="flex items-center gap-3">
          {timeLeft.days > 0 && (
            <>
              <CountdownUnit value={timeLeft.days} label="days" />
              <span className="text-2xl text-text-tertiary font-light -mt-5">:</span>
            </>
          )}
          <CountdownUnit value={timeLeft.hours} label="hrs" />
          <span className="text-2xl text-text-tertiary font-light -mt-5">:</span>
          <CountdownUnit value={timeLeft.minutes} label="min" />
          <span className="text-2xl text-text-tertiary font-light -mt-5">:</span>
          <CountdownUnit value={timeLeft.seconds} label="sec" />
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-text-tertiary hover:text-text-secondary transition-colors mt-2"
        >
          Dismiss and Enter Party
        </button>
      </div>
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-4xl font-bold text-text-primary tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] text-text-tertiary uppercase tracking-wider mt-1">
        {label}
      </span>
    </div>
  );
}
