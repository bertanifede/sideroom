"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    const supabase = createClient();
    let attempts = 0;
    const maxAttempts = 20; // ~20 seconds

    const poll = async () => {
      const { data: party } = await supabase
        .from("parties")
        .select("invite_code")
        .eq("stripe_session_id", sessionId)
        .single();

      if (party) {
        setInviteCode(party.invite_code);
        setStatus("success");
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        setStatus("error");
        return;
      }

      setTimeout(poll, 1000);
    };

    poll();
  }, [sessionId]);

  // Auto-redirect on success
  useEffect(() => {
    if (status === "success" && inviteCode) {
      window.location.href = "/dashboard";
    }
  }, [status, inviteCode]);

  if (status === "error") {
    return (
      <div className="max-w-md w-full px-6 text-center">
        <h1 className="text-xl font-bold mb-2">Something Went Wrong</h1>
        <p className="text-text-secondary mb-6">
          {!sessionId
            ? "No payment session found."
            : "We couldn't confirm your payment. If you were charged, your party will appear on your dashboard shortly."}
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md bg-surface border border-surface-border text-text-primary px-4 py-2 text-sm font-medium hover:bg-surface-hover transition-colors"
        >
          Go to Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full px-6 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface">
        <svg
          className="size-6 text-text-primary animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
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
              <svg
                className="size-6 text-text-primary animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
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
