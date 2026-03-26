import { useCurrentFrame, useVideoConfig, Sequence, spring, interpolate } from "remotion";
import { Facehash } from "facehash";
import { THEME, GUESTS, PARTY, GUEST_ARRIVAL_FRAMES } from "../data/demo-data";

const AVATAR_COLORS = [
  "#f87171", "#fb923c", "#fbbf24", "#a3e635",
  "#34d399", "#22d3ee", "#60a5fa", "#818cf8",
  "#a78bfa", "#e879f9", "#fb7185", "#2dd4bf",
];

const INITIAL_GUESTS = GUESTS.slice(0, 3);
const ARRIVING_GUESTS = GUESTS.slice(3);

const GuestRow: React.FC<{ name: string; isHost: boolean }> = ({ name, isHost }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, config: { damping: 200 } });
  const translateY = interpolate(entrance, [0, 1], [20, 0]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: entrance,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
        <Facehash
          name={name}
          size={28}
          colors={AVATAR_COLORS}
          enableBlink={false}
          showInitial={false}
          intensity3d="medium"
          interactive={false}
        />
      </div>
      <span style={{ fontSize: 14, color: `${THEME.fg}cc` }}>
        {name}
        {isHost && (
          <span style={{ color: `${THEME.fg}66`, marginLeft: 6 }}>Host</span>
        )}
      </span>
    </div>
  );
};

export const SeatList: React.FC = () => {
  const frame = useCurrentFrame();

  const totalVisible = INITIAL_GUESTS.length + ARRIVING_GUESTS.filter((_, i) => {
    return frame >= (GUEST_ARRIVAL_FRAMES[i] ?? 999);
  }).length;

  return (
    <div style={{ padding: "20px 24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 11, color: `${THEME.fg}80`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          In the Room
        </span>
        <span style={{ fontSize: 11, color: `${THEME.fg}66` }}>
          {totalVisible}/{PARTY.seatLimit}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {INITIAL_GUESTS.map((g) => (
          <Sequence key={g.name} from={0} layout="none" >
            <GuestRow name={g.name} isHost={g.isHost} />
          </Sequence>
        ))}
        {ARRIVING_GUESTS.map((g, i) => (
          <Sequence key={g.name} from={GUEST_ARRIVAL_FRAMES[i] ?? 999} layout="none" >
            <GuestRow name={g.name} isHost={g.isHost} />
          </Sequence>
        ))}
      </div>
    </div>
  );
};
