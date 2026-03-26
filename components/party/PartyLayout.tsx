"use client";

import { ReactNode, useEffect, useState } from "react";
import SeatList from "./SeatList";
import ChatPanel from "./ChatPanel";
import { ChatMessage, Track } from "@/types";
import { PresenceUser } from "@/hooks/useRealtimeChannel";
import { getFontCss, getGoogleFontUrl } from "@/lib/fonts";

function formatDuration(seconds: number | null): string {
  if (!seconds || !isFinite(seconds)) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type RightTab = "chat" | "guests" | "notes";

interface PartyLayoutProps {
  theme: { bg: string; fg: string; accent: string; surface: string; font?: string };
  title: string;
  description?: string | null;
  tracks?: Track[];
  statusBadge: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  seats: PresenceUser[];
  seatLimit: number;
  artistName: string;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUserName: string;
  backgroundLayer?: ReactNode;
  overlayLayer?: ReactNode;
}

export default function PartyLayout({
  theme,
  title,
  description,
  tracks,
  statusBadge,
  headerActions,
  children,
  seats,
  seatLimit,
  artistName,
  chatMessages,
  onSendMessage,
  currentUserName,
  backgroundLayer,
  overlayLayer,
}: PartyLayoutProps) {
  const [activeTab, setActiveTab] = useState<RightTab>("chat");

  // Sync body background with party theme
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    const prevOverflow = document.body.style.overflow;
    document.body.style.backgroundColor = theme.bg;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.backgroundColor = prev;
      document.body.style.overflow = prevOverflow;
    };
  }, [theme.bg]);

  // Load Google Font on mount if needed
  useEffect(() => {
    const url = getGoogleFontUrl(theme.font);
    if (!url) return;
    const id = `gfont-${(theme.font ?? "").replace(/ /g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }, [theme.font]);

  return (
    <div
      className="relative h-screen flex flex-col text-[var(--party-fg)] overflow-hidden"
      style={{
        "--party-bg": theme.bg,
        "--party-fg": theme.fg,
        "--party-accent": theme.accent,
        "--party-surface": theme.surface,
        backgroundColor: "var(--party-bg)",
        fontFamily: getFontCss(theme.font),
      } as React.CSSProperties}
    >
      {backgroundLayer}

      {/* ── Header ── */}
      <header className="relative z-10 px-6 py-3 flex items-center justify-between flex-shrink-0 border-b border-[var(--party-fg)]/10">
        <div className="min-w-0 flex-1 mr-4">
          <h1 className="font-bold text-lg">{title}</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {headerActions}
          {statusBadge}
        </div>
      </header>

      {/* ── Two-column body (desktop) / stacked (mobile) ── */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col md:grid md:grid-cols-2 md:gap-0">

        {/* ▸ LEFT COLUMN: artwork centered */}
        <div className="shrink-0 md:flex-1 min-h-0 flex flex-col md:border-r border-[var(--party-fg)]/10">
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 md:py-0">
            {children}
          </div>
        </div>

        {/* ▸ RIGHT COLUMN: tabbed panel */}
        <div className="flex-1 md:h-auto min-h-0 flex flex-col border-t md:border-t-0 border-[var(--party-fg)]/10">
          {/* Tab bar */}
          <div className="flex-shrink-0 flex gap-1 px-4 py-3 border-b border-[var(--party-fg)]/10">
            {([
              { id: "notes" as const, label: "Notes" },
              { id: "chat" as const, label: "Chat" },
              { id: "guests" as const, label: `Guests (${seats.length})` },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors
                  ${activeTab === tab.id
                    ? "text-[var(--party-fg)] bg-[var(--party-fg)]/10 font-medium"
                    : "text-[var(--party-fg)]/40 hover:text-[var(--party-fg)]/70"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {/* Chat */}
            {activeTab === "chat" && (
              <ChatPanel
                messages={chatMessages}
                onSend={onSendMessage}
                currentUserName={currentUserName}
                presenceState={seats}
              />
            )}

            {/* Guests */}
            {activeTab === "guests" && (
              <div className="h-full overflow-y-auto p-4 scrollbar-none" style={{ scrollbarWidth: "none" }}>
                <SeatList
                  seats={seats}
                  seatLimit={seatLimit}
                  artistName={artistName}
                />
              </div>
            )}

            {/* Release Notes */}
            {activeTab === "notes" && (
              <div className="h-full overflow-y-auto p-4 scrollbar-none" style={{ scrollbarWidth: "none" }}>
                {description ? (
                  <p className="text-sm opacity-70 leading-relaxed">{description}</p>
                ) : (
                  <p className="text-sm opacity-40">No release notes.</p>
                )}
                {tracks && tracks.length > 0 && (
                  <div className="mt-5 space-y-2">
                    {tracks.map((track, i) => (
                      <div key={track.id} className="flex items-center justify-between text-sm">
                        <span className="opacity-70 truncate mr-3">
                          <span className="opacity-50 mr-2">{i + 1}.</span>
                          {track.file_name.replace(/\.\w+$/, "")}
                        </span>
                        <span className="opacity-40 text-xs font-mono flex-shrink-0">
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {overlayLayer}
    </div>
  );
}
