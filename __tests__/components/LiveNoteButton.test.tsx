import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LiveNoteButton from "@/components/party/LiveNoteButton";

describe("LiveNoteButton — mobile input zoom fix", () => {
  it("renders the note input at text-base on mobile and md:text-xs on desktop", () => {
    render(
      <LiveNoteButton partyId="party-1" trackId="track-1" currentTime={0} />
    );
    fireEvent.click(screen.getByText("+ Add Note"));
    const input = screen.getByPlaceholderText("Note at this moment...");
    expect(input).toHaveClass("text-base", "md:text-xs");
  });
});
