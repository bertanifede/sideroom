import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatPanel from "@/components/party/ChatPanel";

describe("ChatPanel — mobile input zoom fix", () => {
  it("renders the chat textarea at text-base on mobile and md:text-sm on desktop", () => {
    render(
      <ChatPanel messages={[]} onSend={vi.fn()} currentUserName="Tester" />
    );
    const textarea = screen.getByPlaceholderText("Say something...");
    expect(textarea).toHaveClass("text-base", "md:text-sm");
  });
});
