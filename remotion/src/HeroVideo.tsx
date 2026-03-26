import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/Geist";
import { THEME, GUESTS, GUEST_ARRIVAL_FRAMES } from "./data/demo-data";
import { Header } from "./components/Header";
import { ArtworkAura } from "./components/ArtworkAura";
import { AlbumArt } from "./components/AlbumArt";
import { TrackInfo } from "./components/TrackInfo";
import { SeatList } from "./components/SeatList";
import { ChatPanel } from "./components/ChatPanel";
import { LiveNoteInteraction } from "./components/LiveNoteInteraction";
import { PartyEndedOverlay } from "./components/PartyEndedOverlay";
import { NotesTab } from "./components/NotesTab";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });

const TAB_SWITCH_CHAT = 100;
const TAB_SWITCH_GUESTS = 350;

type TabId = "notes" | "chat" | "guests";

function getActiveTab(frame: number): TabId {
  if (frame < TAB_SWITCH_CHAT) return "notes";
  if (frame < TAB_SWITCH_GUESTS) return "chat";
  return "guests";
}

export const HeroVideo = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fadeInOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOutOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);
  const activeTab = getActiveTab(frame);

  const INITIAL_COUNT = 3;
  const arrivedCount = GUEST_ARRIVAL_FRAMES.filter(f => frame >= f).length;
  const totalGuests = INITIAL_COUNT + arrivedCount;

  const tabs: { id: TabId; label: string }[] = [
    { id: "notes", label: "Notes" },
    { id: "chat", label: "Chat" },
    { id: "guests", label: `Guests (${totalGuests})` },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg, fontFamily }}>
      <div style={{ opacity, position: "absolute", inset: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Header />

        {/* Two-column body */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

          {/* LEFT COLUMN: artwork centered */}
          <div
            style={{
              width: "50%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              borderRight: `1.5px dotted ${THEME.fg}1a`,
            }}
          >
            {/* Aura behind artwork */}
            <div
              style={{
                position: "absolute",
                width: 660,
                height: 660,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -55%)",
                zIndex: 0,
                pointerEvents: "none",
              }}
            >
              <ArtworkAura />
            </div>

            {/* Album art */}
            <div style={{ position: "relative", zIndex: 1 }}>
              <AlbumArt size={340} />
            </div>

            {/* Track info */}
            <div style={{ position: "relative", zIndex: 1, marginTop: 16 }}>
              <TrackInfo />
            </div>

            {/* Live note */}
            <div style={{ position: "relative", zIndex: 1, marginTop: 24 }}>
              <Sequence from={0} durationInFrames={270} layout="none">
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
              </Sequence>
              <Sequence from={270} durationInFrames={150} layout="none">
                <LiveNoteInteraction />
              </Sequence>
            </div>
          </div>

          {/* RIGHT COLUMN: tabbed panel */}
          <div
            style={{
              width: "50%",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {/* Tab bar */}
            <div
              style={{
                display: "flex",
                gap: 4,
                padding: "12px 16px",
                borderBottom: `1.5px dotted ${THEME.fg}1a`,
                flexShrink: 0,
              }}
            >
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  style={{
                    padding: "6px 12px",
                    fontSize: 14,
                    borderRadius: 8,
                    fontWeight: activeTab === tab.id ? 500 : 400,
                    color: activeTab === tab.id ? THEME.fg : `${THEME.fg}66`,
                    backgroundColor: activeTab === tab.id ? `${THEME.fg}1a` : "transparent",
                  }}
                >
                  {tab.label}
                </div>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              {activeTab === "notes" && <NotesTab />}
              {activeTab === "chat" && <ChatPanel />}
              {activeTab === "guests" && <SeatList />}
            </div>
          </div>
        </div>

        {/* Party ended overlay */}
        <Sequence from={420} durationInFrames={180}>
          <PartyEndedOverlay />
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};
