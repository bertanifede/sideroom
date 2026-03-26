import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { THEME, LIVE_NOTE_TEXT } from "../data/demo-data";
import { typewriter } from "../utils/animations";

export const LiveNoteInteraction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const showInput = frame >= 15;
  const showTyping = frame >= 30;
  const showConfirmation = frame >= 100;

  const inputExpand = showInput
    ? spring({ frame: frame - 15, fps, config: { damping: 200 } })
    : 0;

  const typedText = showTyping ? typewriter(frame - 30, LIVE_NOTE_TEXT, 0.3) : "";

  const confirmOpacity = showConfirmation
    ? spring({ frame: frame - 100, fps, config: { damping: 200 } })
    : 0;

  if (showConfirmation) {
    return (
      <div style={{ display: "flex", justifyContent: "center", opacity: confirmOpacity }}>
        <span style={{ fontSize: 12, padding: "6px 12px", color: THEME.accent }}>
          Note added!
        </span>
      </div>
    );
  }

  if (showInput) {
    const inputWidth = interpolate(inputExpand, [0, 1], [0, 300]);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
        <div
          style={{
            width: inputWidth,
            backgroundColor: `${THEME.fg}0d`,
            border: `1px solid ${THEME.fg}1a`,
            borderRadius: 9999,
            padding: "6px 12px",
            fontSize: 12,
            color: typedText ? THEME.fg : `${THEME.fg}4d`,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {typedText || "Note at this moment..."}
        </div>
        {typedText && (
          <div
            style={{
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 9999,
              backgroundColor: THEME.accent,
              color: THEME.bg,
            }}
          >
            Send
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          fontSize: 12,
          padding: "6px 12px",
          borderRadius: 9999,
          backgroundColor: `${THEME.fg}1a`,
          color: `${THEME.fg}99`,
        }}
      >
        + Add Note
      </div>
    </div>
  );
};
