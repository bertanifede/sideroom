interface ArtworkOverlayProps {
  coverImageUrl?: string | null;
  fallbackGradient?: { primary: string; secondary: string };
  title: string;
  crossOrigin?: "" | "anonymous" | "use-credentials";
  showPlayOverlay?: boolean;
  isPlaying?: boolean;
  isLoading?: boolean;
  onTogglePlay?: () => void;
  playbackFinished?: boolean;
}

export default function ArtworkOverlay({
  coverImageUrl,
  fallbackGradient,
  title,
  crossOrigin,
  showPlayOverlay,
  isPlaying,
  isLoading,
  onTogglePlay,
  playbackFinished,
}: ArtworkOverlayProps) {
  return (
    <div className="relative mb-2">
      {coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImageUrl}
          alt={`${title} cover`}
          crossOrigin={crossOrigin}
          className="w-72 md:w-96 aspect-square rounded-2xl object-cover shadow-lg shadow-black/10"
        />
      ) : (
        <div
          className="w-72 md:w-96 aspect-square rounded-2xl shadow-lg shadow-black/10"
          style={{
            background: fallbackGradient
              ? `linear-gradient(135deg, ${fallbackGradient.primary}, ${fallbackGradient.secondary})`
              : "linear-gradient(135deg, #0c51da, #4a9aff)",
          }}
        />
      )}
      {showPlayOverlay && playbackFinished && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl text-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <span className="text-white/90 text-sm font-medium">
            Set finished — all tracks played
          </span>
        </div>
      )}
      {showPlayOverlay && !playbackFinished && (
        <button
          onClick={onTogglePlay}
          disabled={isLoading}
          className={`absolute inset-0 flex items-center justify-center rounded-2xl cursor-pointer transition-opacity duration-500 ${
            isPlaying && !isLoading ? "opacity-0 hover:opacity-60" : "opacity-100"
          }`}
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        >
          <span className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            {isLoading ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="animate-spin">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" strokeDasharray="50 20" strokeLinecap="round" />
              </svg>
            ) : isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="2" />
                <rect x="14" y="4" width="4" height="16" rx="2" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" />
              </svg>
            )}
          </span>
        </button>
      )}
    </div>
  );
}
