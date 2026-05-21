"use client";

import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { usePlaybackSync } from "@/hooks/usePlaybackSync";
import { usePartyChat } from "@/hooks/usePartyChat";
import { useAlbumColors } from "@/hooks/useAlbumColors";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";
import AudioPlayer from "./AudioPlayer";
import LiveNoteButton from "./LiveNoteButton";
import ArtworkOverlay from "./ArtworkOverlay";
import ArtworkAura from "./ArtworkAura";
import PartyLayout from "./PartyLayout";
import CountdownOverlay from "./CountdownOverlay";
import PartyEndedOverlay from "./PartyEndedOverlay";
import DebugOverlay from "./DebugOverlay";
import { Party, PlaybackState, Track } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { useCoarsePointer } from "@/hooks/useCoarsePointer";
import { useFrameHealth } from "@/hooks/useFrameHealth";
import { useAudioDiagnostics } from "@/hooks/useAudioDiagnostics";
import { diag, initDiagnostics } from "@/lib/diagnostics";

interface PartyRoomProps {
  party: Party;
  tracks: Track[];
  isArtist: boolean;
  guestName: string;
  avatarUrl?: string | null;
  seatId: string;
  coverImageUrl?: string | null;
  initialPlaybackState?: PlaybackState | null;
}

export default function PartyRoom({
  party,
  tracks,
  isArtist,
  guestName,
  avatarUrl,
  seatId,
  coverImageUrl,
  initialPlaybackState,
}: PartyRoomProps) {
  const { channel, presenceState: realPresence, isConnected } = useRealtimeChannel(
    party.id,
    guestName,
    avatarUrl
  );

  const {
    audioRef,
    preloadAudioRef,
    swapCount,
    isPlaying,
    currentTime,
    duration,
    currentTrack,
    currentTrackPosition,
    totalTracks,
    needsInteraction,
    play,
    pause,
    playTrack,
    resumeFromInteraction,
    partyEnded,
    playbackFinished,
    endParty,
  } = usePlaybackSync({ channel, isArtist, tracks, partyId: party.id, initialPlaybackState, isConnected, playbackEndedAt: party.playback_ended_at });

  const { messages, sendMessage } = usePartyChat({
    channel,
    partyId: party.id,
    seatId,
    senderName: guestName,
  });

  const [isLoadingPlay, setIsLoadingPlay] = useState(false);

  const handlePlay = useCallback(async () => {
    setIsLoadingPlay(true);
    try {
      await play();
    } finally {
      setIsLoadingPlay(false);
    }
  }, [play]);

  const themeGradientColors = party.theme
    ? { primary: party.theme.bg, secondary: party.theme.accent }
    : { primary: "#0c51da", secondary: "#4a9aff" };

  const colors = useAlbumColors(coverImageUrl ?? null, themeGradientColors);
  const isCoarsePointer = useCoarsePointer();
  const { amplitudeRef } = useAudioAnalyser({
    audioRef,
    isPlaying,
    swapCount,
    enabled: !isCoarsePointer && !diag.flags.noAnalyser,
  });

  useFrameHealth();
  useAudioDiagnostics(audioRef, swapCount);
  useEffect(() => {
    initDiagnostics();
  }, []);

  const statusBadge = isConnected ? (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full bg-emerald-500" />
      <span className="text-xs text-[var(--party-fg)]/60">Connected</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
      <span className="text-xs text-[var(--party-fg)]/60">Connecting...</span>
    </div>
  );

  return (
    <PartyLayout
      theme={{
        bg: party.theme?.bg ?? "#0c51da",
        fg: party.theme?.fg ?? "#ffffff",
        accent: party.theme?.accent ?? "#4a9aff",
        surface: party.theme?.surface ?? "#0a3fa8",
        font: party.theme?.font,
      }}
      title={party.title}
      description={party.description}
      tracks={tracks}
      statusBadge={statusBadge}
      headerActions={
        isArtist && !partyEnded ? (
          <button
            onClick={endParty}
            className="text-xs px-3 py-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            End Party
          </button>
        ) : undefined
      }
      seats={realPresence}
      seatLimit={party.seat_limit}
      artistName={guestName}
      chatMessages={messages}
      onSendMessage={sendMessage}
      currentUserName={guestName}
      backgroundLayer={null}
      overlayLayer={
        <>
          <CountdownOverlay scheduledAt={party.scheduled_at} />
          {partyEnded && (
            <PartyEndedOverlay
              partyId={party.id}
              isArtist={isArtist}
              guestName={guestName}
            />
          )}
          {diag.enabled && <DebugOverlay audioRef={audioRef} />}
        </>
      }
    >
      <div className="relative">
        {!isCoarsePointer && (
          <ArtworkAura
            colors={colors.palette}
            scale={2.2}
            blur={50}
            grain={0.35}
            pulseSpeed={4}
            amplitudeRef={amplitudeRef}
          />
        )}
        <ArtworkOverlay
          coverImageUrl={coverImageUrl}
          fallbackGradient={themeGradientColors}
          title={party.title}
          crossOrigin="anonymous"
          showPlayOverlay={isArtist}
          isPlaying={isPlaying}
          isLoading={isLoadingPlay}
          onTogglePlay={isPlaying ? pause : handlePlay}
          playbackFinished={playbackFinished}
          needsResume={!isArtist && needsInteraction}
          onResume={resumeFromInteraction}
        />
      </div>
      <p className="text-base font-semibold tracking-tight text-center mt-4">
        {currentTrack?.file_name ?? party.file_name}
      </p>
      <div className="w-full max-w-sm mt-3">
        <AudioPlayer
          audioRef={audioRef}
          preloadAudioRef={preloadAudioRef}
          swapCount={swapCount}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          isArtist={isArtist}
          onPlay={handlePlay}
          onPause={pause}
          needsInteraction={needsInteraction}
        />
      </div>
      {playbackFinished && !partyEnded && (
        <p role="status" className="text-sm text-[var(--party-fg)]/60 text-center mt-3 w-full max-w-sm">
          {isArtist ? (
            <>
              {"All tracks played — guests can still chat."}
              <br />
              {"Tap End Party when you're ready."}
            </>
          ) : (
            "Audio ended — say goodbye in the chat."
          )}
        </p>
      )}
      {!partyEnded && (
        <div className="w-full max-w-sm mt-2">
          <LiveNoteButton
            partyId={party.id}
            trackId={currentTrack?.id ?? null}
            currentTime={currentTime}
          />
        </div>
      )}
    </PartyLayout>
  );
}
