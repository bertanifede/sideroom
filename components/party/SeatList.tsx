"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { PresenceUser } from "@/hooks/useRealtimeChannel";
import GuestAvatar from "@/components/party/GuestAvatar";

interface SeatListProps {
  seats: PresenceUser[];
  seatLimit: number;
  artistName: string;
  /** "list" = single column (default), "grid" = responsive 2-col desktop / 4-col mobile */
  layout?: "list" | "grid";
}

export default function SeatList({ seats, seatLimit, artistName, layout = "list" }: SeatListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const checkFade = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const isScrollable = el.scrollHeight > el.clientHeight + 4;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    setShowFade(isScrollable && !isAtBottom);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    checkFade();
    const obs = new ResizeObserver(checkFade);
    obs.observe(el);
    el.addEventListener("scroll", checkFade, { passive: true });
    return () => {
      obs.disconnect();
      el.removeEventListener("scroll", checkFade);
    };
  }, [seats.length, checkFade]);

  return (
    <div className="flex flex-col overflow-hidden relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--party-fg)]/50 uppercase tracking-wider">
          In the Room
        </span>
        <span className="text-xs text-[var(--party-fg)]/40">
          {seats.length}/{seatLimit}
        </span>
      </div>
      <div
        ref={listRef}
        className={`overflow-y-auto max-h-96 pb-6 scrollbar-none ${
          layout === "grid"
            ? "grid grid-cols-4 md:grid-cols-2 gap-2"
            : "space-y-1.5"
        }`}
        style={{ scrollbarWidth: "none" }}
      >
        {seats.map((seat, i) => (
          <div key={i} className={`flex items-center gap-2 ${layout === "grid" ? "min-w-0" : ""}`}>
            {seat.avatar_url ? (
              <img
                src={seat.avatar_url}
                alt={seat.guest_name}
                className="w-6 h-6 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <GuestAvatar name={seat.guest_name} size={24} />
            )}
            <span className="text-xs text-[var(--party-fg)]/80 truncate">
              {seat.guest_name}
              {seat.guest_name === artistName && (
                <span className="text-[var(--party-fg)]/40 ml-1">Host</span>
              )}
            </span>
          </div>
        ))}
      </div>
      {/* Fade overlay at bottom to hint more content */}
      {showFade && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-12"
          style={{
            background: "linear-gradient(to top, var(--party-bg), transparent)",
          }}
        />
      )}
    </div>
  );
}
