"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "loading" | "no_session" | "not_paid" | "pending";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

function Spinner() {
  return (
    <svg
      className="size-6 text-text-primary animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function DashboardLink({ label }: { label: string }) {
  return (
    <a
      href="/dashboard"
      className="inline-flex items-center justify-center rounded-md bg-surface border border-surface-border text-text-primary px-4 py-2 text-sm font-medium hover:bg-surface-hover transition-colors"
    >
      {label}
    </a>
  );
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<Status>(() =>
    searchParams.get("session_id") ? "loading" : "no_session"
  );

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    const finalize = async (attempt: number): Promise<void> => {
      try {
        const res = await fetch("/api/checkout/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (data.invite_code) {
            window.location.href = "/dashboard";
            return;
          }
          if (data.status === "not_paid") {
            setStatus("not_paid");
            return;
          }
        }

        // 5xx / 409 / unexpected — retry a few times, then the webhook
        // is the backstop: show the calm "being set up" message.
        if (attempt + 1 < MAX_ATTEMPTS) {
          setTimeout(() => finalize(attempt + 1), RETRY_DELAY_MS);
          return;
        }
        setStatus("pending");
      } catch {
        if (cancelled) return;
        if (attempt + 1 < MAX_ATTEMPTS) {
          setTimeout(() => finalize(attempt + 1), RETRY_DELAY_MS);
          return;
        }
        setStatus("pending");
      }
    };

    finalize(0);
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (status === "no_session") {
    return (
      <div className="max-w-md w-full px-6 text-center">
        <h1 className="text-xl font-bold mb-2">Something Went Wrong</h1>
        <p className="text-text-secondary mb-6">No payment session found.</p>
        <DashboardLink label="Go to Dashboard" />
      </div>
    );
  }

  if (status === "not_paid") {
    return (
      <div className="max-w-md w-full px-6 text-center">
        <h1 className="text-xl font-bold mb-2">Payment Didn&apos;t Go Through</h1>
        <p className="text-text-secondary mb-6">
          Your payment wasn&apos;t completed, so no party was created. You can
          try again from your dashboard.
        </p>
        <DashboardLink label="Go to Dashboard" />
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="max-w-md w-full px-6 text-center">
        <h1 className="text-xl font-bold mb-2">Payment Received</h1>
        <p className="text-text-secondary mb-6">
          Your party is being set up — it will appear on your dashboard
          shortly.
        </p>
        <DashboardLink label="Go to Dashboard" />
      </div>
    );
  }

  // loading
  return (
    <div className="max-w-md w-full px-6 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface">
        <Spinner />
      </div>
      <h1 className="text-xl font-bold mb-2">Confirming Payment...</h1>
      <p className="text-text-secondary">
        Setting up your party. You&apos;ll be redirected automatically.
      </p>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-blue text-text-primary">
      <Suspense
        fallback={
          <div className="max-w-md w-full px-6 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface">
              <Spinner />
            </div>
            <h1 className="text-xl font-bold mb-2">Confirming Payment...</h1>
          </div>
        }
      >
        <PaymentSuccessContent />
      </Suspense>
    </div>
  );
}
