import { useCurrentFrame, useVideoConfig, Sequence, spring, interpolate } from "remotion";
import { Facehash } from "facehash";
import { THEME, CHAT_MESSAGES } from "../data/demo-data";

const AVATAR_COLORS = [
  "#f87171", "#fb923c", "#fbbf24", "#a3e635",
  "#34d399", "#22d3ee", "#60a5fa", "#818cf8",
  "#a78bfa", "#e879f9", "#fb7185", "#2dd4bf",
];

const CHAT_TIMINGS = [120, 155, 170, 230];

const ChatMessage: React.FC<{ sender: string; text: string }> = ({ sender, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, config: { damping: 200 } });
  const translateY = interpolate(entrance, [0, 1], [16, 0]);
  const isHost = sender === "fedex";

  if (isHost) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          opacity: entrance,
          transform: `translateY(${translateY}px)`,
          padding: "4px 0",
        }}
      >
        <div
          style={{
            backgroundColor: `${THEME.accent}33`,
            borderRadius: 12,
            borderBottomRightRadius: 4,
            padding: "8px 12px",
            maxWidth: "80%",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: `${THEME.fg}cc` }}>
            {sender}
            <span style={{ color: `${THEME.fg}40`, marginLeft: 4, fontWeight: 400 }}>Host</span>
          </span>
          <p style={{ fontSize: 14, color: `${THEME.fg}ee`, margin: "2px 0 0 0" }}>
            {text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        opacity: entrance,
        transform: `translateY(${translateY}px)`,
        padding: "4px 0",
      }}
    >
      <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", flexShrink: 0, marginTop: 2 }}>
        <Facehash
          name={sender}
          size={24}
          colors={AVATAR_COLORS}
          enableBlink={false}
          showInitial={false}
          intensity3d="medium"
          interactive={false}
        />
      </div>
      <div>
        <span style={{ fontSize: 12, fontWeight: 600, color: `${THEME.fg}cc` }}>
          {sender}
        </span>
        <p style={{ fontSize: 14, color: `${THEME.fg}ee`, margin: "2px 0 0 0" }}>
          {text}
        </p>
      </div>
    </div>
  );
};

export const ChatPanel: React.FC = () => {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: "16px 24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        {CHAT_MESSAGES.map((msg, i) => (
          <Sequence key={i} from={CHAT_TIMINGS[i] ?? 999} layout="none" >
            <ChatMessage sender={msg.sender} text={msg.text} />
          </Sequence>
        ))}
      </div>

      {/* Input placeholder */}
      <div
        style={{
          padding: "12px 24px 16px",
          borderTop: `1.5px dotted ${THEME.fg}1a`,
        }}
      >
        <div
          style={{
            backgroundColor: `${THEME.fg}0d`,
            borderRadius: 9999,
            padding: "10px 16px",
            fontSize: 14,
            color: `${THEME.fg}4d`,
          }}
        >
          Say something...
        </div>
      </div>
    </div>
  );
};
