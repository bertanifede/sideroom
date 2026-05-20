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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PaymentSuccessPage />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(screen.getByText(/being set up/i)).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("redirects to the dashboard when finalize returns an invite_code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invite_code: "iron-glow-abc" }),
      })
    );
    // jsdom does not implement navigation; swap window.location to capture
    // the href assignment, and restore it afterward.
    const original = window.location;
    const fakeLocation = { href: "" } as Location;
    Object.defineProperty(window, "location", {
      value: fakeLocation,
      writable: true,
      configurable: true,
    });
    try {
      render(<PaymentSuccessPage />);
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(fakeLocation.href).toBe("/dashboard");
    } finally {
      Object.defineProperty(window, "location", {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });
});
