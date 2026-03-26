import { Track } from "@/types";

function formatDuration(seconds: number | null): string {
  if (!seconds || !isFinite(seconds)) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ReleaseNoteDialogProps {
  description: string;
  tracks?: Track[];
  open: boolean;
  onClose: () => void;
}

export default function ReleaseNoteDialog({ description, tracks, open, onClose }: ReleaseNoteDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative max-w-md w-full rounded-2xl p-6 max-h-[80vh] overflow-y-auto scrollbar-none"
        style={{ backgroundColor: "var(--party-surface)", scrollbarWidth: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-lg">Release Notes</h2>
          <button
            onClick={onClose}
            className="opacity-40 hover:opacity-70 transition-opacity p-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm opacity-70 leading-relaxed">{description}</p>
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
    </div>
  );
}
