import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

let searchString = "session_id=cs_1";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchString),
}));

import PaymentSuccessPage from "@/app/payment/success/page";

describe("PaymentSuccessPage", () => {
  beforeEach(() => {
    searchString = "session_id=cs_1";
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the no-session error when session_id is absent", async () => {
    searchString = "";
    vi.stubGlobal("fetch", vi.fn());
    render(<PaymentSuccessPage />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(screen.getByText(/no payment session found/i)).toBeInTheDocument();
  });

  it("shows the payment-failed message when finalize reports not_paid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "not_paid" }),
      })
    );
    render(<PaymentSuccessPage />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(screen.getByText(/payment didn.?t go through/i)).toBeInTheDocument();
  });

  it("shows the calm pending message after finalize keeps failing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) })
    );
    render(<PaymentSuccessPage />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(screen.getByText(/being set up/i)).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
