"use client";

import { useAlbumColors } from "@/hooks/useAlbumColors";

interface PartyPreviewCardProps {
  themeBg: string;
  themeFg: string;
  themeAccent: string;
  themeSurface: string;
  coverPreview: string | null;
  title: string;
  trackNames: string[];
}

export default function PartyPreviewCard({
  themeBg,
  themeFg,
  themeAccent,
  themeSurface,
  coverPreview,
  title,
  trackNames,
}: PartyPreviewCardProps) {
  const colors = useAlbumColors(coverPreview, { primary: themeBg, secondary: themeAccent });

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-surface-border"
      style={
        {
          "--party-bg": themeBg,
          "--party-fg": themeFg,
          "--party-accent": themeAccent,
          "--party-surface": themeSurface,
          backgroundColor: "var(--party-bg)",
          color: "var(--party-fg)",
        } as React.CSSProperties
      }
    >
      {/* Glow background */}
      <div
        className="absolute inset-0 opacity-40 animate-[glow-breathe_6s_ease-in-out_infinite]"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${colors.primary}88, ${colors.secondary}44, transparent 70%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {coverPreview ? (
            <img
              src={coverPreview}
              alt="Cover"
              className="w-12 h-12 rounded-lg object-cover shadow-lg"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-lg"
              style={{ backgroundColor: themeSurface }}
            />
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{title || "Untitled Party"}</p>
            <p className="text-xs opacity-50">
              {trackNames.length} track{trackNames.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Mini tracklist */}
        <div className="mb-4 space-y-1">
          {trackNames.slice(0, 3).map((name, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
              style={{
                backgroundColor: i === 0 ? `${themeAccent}1a` : "transparent",
                opacity: i === 0 ? 1 : 0.5,
              }}
            >
              <span className="font-mono opacity-50 w-3 text-right">{i + 1}</span>
              <span className="truncate">{name}</span>
              {i === 0 && (
                <span className="ml-auto flex gap-0.5 shrink-0">
                  <span
                    className="w-0.5 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: "var(--party-fg)" }}
                  />
                  <span
                    className="w-0.5 h-3 rounded-full animate-pulse"
                    style={{ backgroundColor: "var(--party-fg)", animationDelay: "75ms" }}
                  />
                  <span
                    className="w-0.5 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: "var(--party-fg)", animationDelay: "150ms" }}
                  />
                </span>
              )}
            </div>
          ))}
          {trackNames.length > 3 && (
            <p className="text-xs opacity-40 px-2">
              +{trackNames.length - 3} more
            </p>
          )}
        </div>

        {/* Mini seat row */}
        <div className="flex items-center gap-1 mb-4">
          <span className="text-xs opacity-40 mr-1">In the Room</span>
          <span className="text-sm">🎤</span>
          <span className="text-sm">🎧</span>
          <span className="text-sm opacity-30">🪑</span>
        </div>

        {/* Mini chat preview */}
        <div
          className="rounded-xl p-3 space-y-2 backdrop-blur-xl"
          style={{ backgroundColor: `${themeSurface}99` }}
        >
          <div className="flex flex-col items-end">
            <span className="text-[9px] opacity-40 mb-0.5">you</span>
            <div
              className="px-2.5 py-1.5 rounded-xl text-xs max-w-[70%]"
              style={{ backgroundColor: themeAccent, color: themeBg }}
            >
              Welcome everyone! 🎶
            </div>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[9px] opacity-40 mb-0.5">guest</span>
            <div
              className="px-2.5 py-1.5 rounded-xl text-xs max-w-[70%]"
              style={{ backgroundColor: themeSurface }}
            >
              So hyped for this 🔥
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
