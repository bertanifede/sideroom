import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import AudioPlayer from "@/components/party/AudioPlayer";

function renderPlayer(overrides: Partial<Parameters<typeof AudioPlayer>[0]> = {}) {
  const defaults = {
    audioRef: createRef<HTMLAudioElement>(),
    isPlaying: false,
    currentTime: 0,
    duration: 180,
    isArtist: false,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    needsInteraction: false,
    onResume: vi.fn(),
  };
  return render(<AudioPlayer {...defaults} {...overrides} />);
}

describe("AudioPlayer", () => {
  it("renders 'Tap to start listening' when needsInteraction=true and guest", () => {
    renderPlayer({ needsInteraction: true, isArtist: false });
    expect(screen.getByText("Tap to start listening")).toBeInTheDocument();
  });

  it("does NOT show 'Tap to start listening' when needsInteraction=false", () => {
    renderPlayer({ needsInteraction: false, isArtist: false });
    expect(screen.queryByText("Tap to start listening")).not.toBeInTheDocument();
  });

  it("calls onResume when the tap-to-listen button is clicked", () => {
    const onResume = vi.fn();
    renderPlayer({ needsInteraction: true, isArtist: false, onResume });

    fireEvent.click(screen.getByText("Tap to start listening"));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it("shows listening indicator when playing and not needsInteraction", () => {
    renderPlayer({ isPlaying: true, needsInteraction: false, isArtist: false });
    expect(screen.getByText("Listening")).toBeInTheDocument();
  });

  it("does NOT show listening indicator when needsInteraction is true", () => {
    renderPlayer({ isPlaying: true, needsInteraction: true, isArtist: false });
    expect(screen.queryByText("Listening")).not.toBeInTheDocument();
  });

  it("does not render tap-to-listen button for artist", () => {
    renderPlayer({ isArtist: true, needsInteraction: true });
    expect(screen.queryByText("Tap to start listening")).not.toBeInTheDocument();
  });
});
