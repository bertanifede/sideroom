import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, Palette, RotateCcw, X } from "lucide-react";
import { UploadFile } from "@/hooks/useFileUpload";
import { FONT_OPTIONS, getFontCss, getGoogleFontUrl } from "@/lib/fonts";
import ArtworkOverlay from "@/components/party/ArtworkOverlay";
import ColorPickerField from "@/components/party/ColorPickerField";

const ChatPanel = dynamic(() => import("@/components/party/ChatPanel"));
const SeatList = dynamic(() => import("@/components/party/SeatList"));

function formatDuration(seconds: number | null): string {
  if (!seconds || !isFinite(seconds)) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type RightTab = "chat" | "guests" | "notes";

const FAKE_SEATS = [
  { guest_name: "you (host)" },
  { guest_name: "guest" },
];

interface WizardStepPreviewProps {
  title: string;
  description: string;
  coverPreview: string | null;
  themeBg: string;
  setThemeBg: (v: string) => void;
  themeFg: string;
  setThemeFg: (v: string) => void;
  themeAccent: string;
  setThemeAccent: (v: string) => void;
  themeSurface: string;
  setThemeSurface: (v: string) => void;
  themeFont: string;
  setThemeFont: (v: string) => void;
  files: UploadFile[];
  seatLimit: number;
  busy: boolean;
  isUploading: boolean;
  overallProgress: number;
  submitting: boolean;
  submittingLabel: string;
  submitLabel: string;
  error: string;
  onBack: () => void;
  onSubmit: () => void;
}

export default function WizardStepPreview({
  title,
  description,
  coverPreview,
  themeBg,
  setThemeBg,
  themeFg,
  setThemeFg,
  themeAccent,
  setThemeAccent,
  themeSurface,
  setThemeSurface,
  themeFont,
  setThemeFont,
  files,
  seatLimit,
  busy,
  isUploading,
  overallProgress,
  submitting,
  submittingLabel,
  submitLabel,
  error,
  onBack,
  onSubmit,
}: WizardStepPreviewProps) {
  const [showCustomize, setShowCustomize] = useState(false);
  const [activeTab, setActiveTab] = useState<RightTab>("chat");

  // Sync body background with theme
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    const prevOverflow = document.body.style.overflow;
    document.body.style.backgroundColor = themeBg;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.backgroundColor = prev;
      document.body.style.overflow = prevOverflow;
    };
  }, [themeBg]);

  // Load Google Fonts when selected
  useEffect(() => {
    const url = getGoogleFontUrl(themeFont);
    if (!url) return;
    const id = `gfont-${themeFont.replace(/ /g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }, [themeFont]);

  const fallbackGradient = { primary: themeBg, secondary: themeAccent };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col text-[var(--party-fg)] overflow-hidden"
      style={{
        '--party-bg': themeBg,
        '--party-fg': themeFg,
        '--party-accent': themeAccent,
        '--party-surface': themeSurface,
        backgroundColor: 'var(--party-bg)',
        fontFamily: getFontCss(themeFont),
      } as React.CSSProperties}
    >
      {/* ── Header ── */}
      <header className="px-6 py-3 flex items-center justify-between flex-shrink-0 border-b border-[var(--party-fg)]/10">
        <div className="min-w-0 flex-1 mr-4">
          <h1 className="font-bold text-lg">{title}</h1>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-[var(--party-fg)]/60">preview</span>
        </div>
      </header>

      {/* ── Two-column body (desktop) / stacked (mobile) ── */}
      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-2 md:gap-0">

        {/* ▸ LEFT COLUMN: artwork centered */}
        <div className="shrink-0 md:flex-1 min-h-0 flex flex-col md:border-r border-[var(--party-fg)]/10">
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 md:py-0">
            <ArtworkOverlay
              coverImageUrl={coverPreview}
              fallbackGradient={fallbackGradient}
              title={title}
            />
            <p className="text-base font-semibold tracking-tight text-center mt-4">
              {files[0]?.name}
            </p>
          </div>
        </div>

        {/* ▸ RIGHT COLUMN: tabbed panel */}
        <div className="flex-1 md:h-auto min-h-0 flex flex-col border-t md:border-t-0 border-[var(--party-fg)]/10">
          {/* Tab bar */}
          <div className="flex-shrink-0 flex gap-1 px-4 py-3 border-b border-[var(--party-fg)]/10">
            {([
              { id: "notes" as const, label: "Notes" },
              { id: "chat" as const, label: "Chat" },
              { id: "guests" as const, label: `Guests (${FAKE_SEATS.length})` },
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
            {/* Chat (disabled preview) */}
            {activeTab === "chat" && (
              <ChatPanel
                messages={[]}
                onSend={() => {}}
                currentUserName="host"
                disabled
                presenceState={FAKE_SEATS}
              />
            )}

            {/* Guests */}
            {activeTab === "guests" && (
              <div className="h-full overflow-y-auto p-4 scrollbar-none" style={{ scrollbarWidth: "none" }}>
                <SeatList
                  seats={FAKE_SEATS}
                  seatLimit={seatLimit}
                  artistName="you (host)"
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
                {files.length > 0 && (
                  <div className="mt-5 space-y-2">
                    {files.map((f, i) => (
                      <div key={f.id} className="flex items-center justify-between text-sm">
                        <span className="opacity-70 truncate mr-3">
                          <span className="opacity-50 mr-2">{i + 1}.</span>
                          {f.name.replace(/\.\w+$/, "")}
                        </span>
                        <span className="opacity-40 text-xs font-mono flex-shrink-0">
                          {formatDuration(f.duration ?? null)}
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

      {/* Floating top bar — Page Design toggle */}
      <div className="fixed top-3 right-3 z-40">
        <button
          onClick={() => setShowCustomize((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium backdrop-blur-xl
                      border transition-colors cursor-pointer shadow-lg ${
            showCustomize
              ? "bg-[var(--party-accent)]/20 text-[var(--party-accent)] border-[var(--party-accent)]/30"
              : "bg-[var(--party-surface)]/60 text-[var(--party-fg)]/70 border-[var(--party-fg)]/10 hover:text-[var(--party-fg)]"
          }`}
        >
          <Palette className="size-3.5" />
          Page Design
        </button>
      </div>

      {/* Customize panel */}
      {showCustomize && (
        <div className="fixed top-14 left-0 right-0 z-40 p-4">
          <div className="max-w-lg mx-auto bg-[var(--party-surface)]/80 backdrop-blur-xl rounded-2xl
                          border border-[var(--party-fg)]/10 p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-[var(--party-fg)]">Page Design</span>
              <button
                onClick={() => setShowCustomize(false)}
                className="text-[var(--party-fg)]/40 hover:text-[var(--party-fg)] transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            {/* Font selector */}
            <div>
              <span className="text-xs text-[var(--party-fg)]/60 mb-1.5 block">Font</span>
              <div className="flex flex-wrap gap-1.5">
                {FONT_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setThemeFont(f.id)}
                    style={{ fontFamily: f.css }}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                      themeFont === f.id
                        ? "bg-[var(--party-accent)]/20 text-[var(--party-accent)] ring-1 ring-[var(--party-accent)]/40"
                        : "bg-[var(--party-fg)]/5 text-[var(--party-fg)]/60 hover:text-[var(--party-fg)]/80"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ColorPickerField
                label="Background"
                value={themeBg}
                onChange={setThemeBg}
                presets={["#0c51da", "#000000", "#0a0a1a", "#1a0a2e", "#0a1a0a", "#1a0a0a", "#0f172a"]}
              />
              <ColorPickerField
                label="Text"
                value={themeFg}
                onChange={setThemeFg}
                presets={["#ffffff", "#fef3c7", "#e2e8f0", "#d1d5db"]}
              />
              <ColorPickerField
                label="Accent"
                value={themeAccent}
                onChange={setThemeAccent}
                presets={["#4a9aff", "#ffffff", "#f59e0b", "#8b5cf6", "#3b82f6", "#ec4899", "#10b981", "#ef4444"]}
              />
              <ColorPickerField
                label="Surface"
                value={themeSurface}
                onChange={setThemeSurface}
                presets={["#0a3fa8", "#18181b", "#27272a", "#0f172a", "#1e1b4b", "#1a0a2e"]}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--party-fg)]/60 hover:text-[var(--party-fg)] hover:bg-[var(--party-fg)]/10"
              onClick={() => {
                setThemeBg("#0c51da");
                setThemeFg("#ffffff");
                setThemeAccent("#4a9aff");
                setThemeSurface("#0a3fa8");
                setThemeFont("");
              }}
            >
              <RotateCcw className="size-3" />
              Reset to Defaults
            </Button>
          </div>
        </div>
      )}

      {/* Floating bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-4">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3
                        bg-[var(--party-surface)]/60 backdrop-blur-xl rounded-2xl
                        border border-[var(--party-fg)]/10 px-4 py-3 shadow-2xl">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={busy}
            className="text-[var(--party-fg)] hover:bg-[var(--party-fg)]/10"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Lock className="size-3 text-[var(--party-fg)]/40" />
            <span className="text-[10px] text-[var(--party-fg)]/40 hidden sm:inline">
              Files Encrypted &amp; Auto-Deleted
            </span>
          </div>

          <Button
            onClick={onSubmit}
            disabled={busy}
            className="bg-[var(--party-accent)] text-[var(--party-bg)] hover:bg-[var(--party-accent)]/90 rounded-full px-6 cursor-pointer"
          >
            {isUploading
              ? <><span>Uploading... </span><span className="tabular-nums">{overallProgress}%</span></>
              : submitting
                ? submittingLabel
                : submitLabel}
          </Button>
        </div>

        {/* Upload progress */}
        {isUploading && (
          <div className="max-w-lg mx-auto mt-2">
            <div className="w-full h-1.5 bg-[var(--party-surface)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--party-accent)] rounded-full transition-[width] duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40
                        bg-destructive/90 backdrop-blur text-text-primary text-sm px-4 py-2 rounded-xl shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
