import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { THEME, FEEDBACK_TEXT } from "../data/demo-data";
import { typewriter } from "../utils/animations";

export const PartyEndedOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const overlayOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  const titleOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const formOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const typedText = frame >= 45 ? typewriter(frame - 45, FEEDBACK_TEXT, 1.2) : "";
  const showSent = frame >= 130;

  const sentOpacity = showSent
    ? spring({ frame: frame - 130, fps, config: { damping: 200 } })
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: `rgba(12,40,140,${0.88 * overlayOpacity})`,
        backdropFilter: `blur(${4 * overlayOpacity}px)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div style={{ textAlign: "center", padding: 24, maxWidth: 448, width: "100%" }}>
        <h2
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 24,
            opacity: titleOpacity,
          }}
        >
          Party Ended
        </h2>

        {!showSent ? (
          <div style={{ opacity: formOpacity }}>
            <div
              style={{
                width: "100%",
                minHeight: 100,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "12px 16px",
                fontSize: 14,
                color: typedText ? "#fff" : "rgba(255,255,255,0.3)",
                textAlign: "left",
                lineHeight: 1.5,
              }}
            >
              {typedText || "Leave a note for the artist..."}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", padding: "10px 20px" }}>
                Skip & Review Tracks
              </span>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: 9999,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  opacity: typedText ? 1 : 0.4,
                }}
              >
                Send Note
              </div>
            </div>
          </div>
        ) : (
          <div style={{ opacity: sentOpacity }}>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
              Your note has been sent. Thank you!
            </p>
            <div
              style={{
                display: "inline-block",
                marginTop: 16,
                fontSize: 14,
                fontWeight: 500,
                color: "#fff",
                padding: "10px 20px",
                borderRadius: 9999,
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              Review Tracks →
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
