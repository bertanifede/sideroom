import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ArtworkOverlay from "@/components/party/ArtworkOverlay";

describe("ArtworkOverlay — guest resume overlay", () => {
  it("renders 'Tap to resume' when needsResume is true", () => {
    render(<ArtworkOverlay title="Test" needsResume onResume={vi.fn()} />);
    expect(screen.getByText("Tap to resume")).toBeInTheDocument();
  });

  it("does NOT render the resume overlay when needsResume is false", () => {
    render(
      <ArtworkOverlay title="Test" needsResume={false} onResume={vi.fn()} />
    );
    expect(screen.queryByText("Tap to resume")).not.toBeInTheDocument();
  });

  it("calls onResume when the resume overlay is tapped", () => {
    const onResume = vi.fn();
    render(<ArtworkOverlay title="Test" needsResume onResume={onResume} />);
    fireEvent.click(screen.getByText("Tap to resume"));
    expect(onResume).toHaveBeenCalledOnce();
  });
});
