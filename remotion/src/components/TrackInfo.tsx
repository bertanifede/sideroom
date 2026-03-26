import { useCurrentFrame, useVideoConfig } from "remotion";
import { THEME, CURRENT_TRACK } from "../data/demo-data";
import { formatTime, fadeIn } from "../utils/animations";

type TrackInfoProps = {
  startTime?: number;
};

export const TrackInfo: React.FC<TrackInfoProps> = ({ startTime = 84 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = fadeIn(frame, fps * 0.5);

  const elapsedSec = startTime + frame / fps;
  const displayTime = Math.min(elapsedSec, CURRENT_TRACK.duration);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, opacity }}>
      <p
        style={{
          color: THEME.fg,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          margin: 0,
          marginTop: 16,
        }}
      >
        {CURRENT_TRACK.name}
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 200 }}>
        <span style={{ fontSize: 12, color: `${THEME.fg}80` }}>
          {formatTime(displayTime)}
        </span>
        <span style={{ fontSize: 12, color: `${THEME.fg}80` }}>
          {formatTime(CURRENT_TRACK.duration)}
        </span>
      </div>

    </div>
  );
};
