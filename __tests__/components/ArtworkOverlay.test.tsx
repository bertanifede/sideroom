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

describe("ArtworkOverlay — responsive artwork size", () => {
  it("renders the cover image at w-40 on mobile and md:w-96 on desktop", () => {
    render(
      <ArtworkOverlay title="Test" coverImageUrl="https://example.com/cover.jpg" />
    );
    const img = screen.getByAltText("Test cover");
    expect(img).toHaveClass("w-40", "md:w-96");
  });

  it("renders the gradient fallback at w-40 on mobile and md:w-96 on desktop", () => {
    const { container } = render(<ArtworkOverlay title="Test" />);
    const fallback = container.querySelector("div.aspect-square");
    expect(fallback).toHaveClass("w-40", "md:w-96");
  });
});
