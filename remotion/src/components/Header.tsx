import { useCurrentFrame, useVideoConfig } from "remotion";
import { THEME, PARTY } from "../data/demo-data";
import { fadeIn } from "../utils/animations";

export const Header: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = fadeIn(frame, fps * 0.5);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: `1.5px dotted ${THEME.fg}1a`,
        opacity,
        flexShrink: 0,
      }}
    >
      <h1
        style={{
          color: THEME.fg,
          fontSize: 24,
          fontWeight: 700,
          margin: 0,
          letterSpacing: "-0.02em",
        }}
      >
        {PARTY.title}
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#10b981",
          }}
        />
        <span style={{ fontSize: 12, color: `${THEME.fg}99` }}>
          Connected
        </span>
      </div>
    </div>
  );
};
