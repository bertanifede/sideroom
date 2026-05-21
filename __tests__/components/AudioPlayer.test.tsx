import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  };
  return render(<AudioPlayer {...defaults} {...overrides} />);
}

describe("AudioPlayer", () => {
  it("shows listening indicator when playing and not needsInteraction", () => {
    renderPlayer({ isPlaying: true, needsInteraction: false, isArtist: false });
    expect(screen.getByText("Listening")).toBeInTheDocument();
  });

  it("does NOT show listening indicator when needsInteraction is true", () => {
    renderPlayer({ isPlaying: true, needsInteraction: true, isArtist: false });
    expect(screen.queryByText("Listening")).not.toBeInTheDocument();
  });
});
