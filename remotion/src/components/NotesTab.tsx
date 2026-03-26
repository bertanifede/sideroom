import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { THEME, PARTY, TRACKS } from "../data/demo-data";
import { formatTime, fadeIn } from "../utils/animations";

export const NotesTab: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const descriptionOpacity = fadeIn(frame, 20);

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* Description */}
      <p
        style={{
          fontSize: 14,
          color: `${THEME.fg}b3`,
          lineHeight: 1.6,
          margin: 0,
          opacity: descriptionOpacity,
        }}
      >
        {PARTY.description}
      </p>

      {/* Tracklist */}
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
        {TRACKS.map((track, i) => {
          const delay = 10 + i * 5;
          const trackEntrance = spring({
            frame: frame - delay,
            fps,
            config: { damping: 200 },
          });
          const translateY = interpolate(trackEntrance, [0, 1], [12, 0]);

          return (
            <div
              key={track.position}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: trackEntrance,
                transform: `translateY(${translateY}px)`,
              }}
            >
              <span style={{ fontSize: 14, color: `${THEME.fg}b3` }}>
                <span style={{ color: `${THEME.fg}80`, marginRight: 8 }}>
                  {track.position}.
                </span>
                {track.name}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: `${THEME.fg}66`,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatTime(track.duration)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
