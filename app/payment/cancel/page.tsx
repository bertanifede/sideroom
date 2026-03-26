"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function CancelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (sessionId) {
      router.replace(`/create-party?session_id=${sessionId}`);
    }
  }, [sessionId, router]);

  if (sessionId) {
    return (
      <div className="max-w-md w-full px-6 text-center">
        <h1 className="text-xl font-bold mb-2">Returning to Editor...</h1>
        <p className="text-text-secondary">Your uploads are safe.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full px-6 text-center">
      <h1 className="text-xl font-bold mb-2">Checkout Cancelled</h1>
      <p className="text-text-secondary mb-6">No payment was charged.</p>
      <div className="flex gap-3 justify-center">
        <a
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md border border-surface-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors"
        >
          Dashboard
        </a>
        <a
          href="/create-party"
          className="inline-flex items-center justify-center rounded-md bg-surface border border-surface-border text-text-primary px-4 py-2 text-sm font-medium hover:bg-surface-hover transition-colors"
        >
          Create a Party
        </a>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-blue text-text-primary">
      <Suspense
        fallback={
          <div className="max-w-md w-full px-6 text-center">
            <h1 className="text-xl font-bold mb-2">Loading...</h1>
          </div>
        }
      >
        <CancelContent />
      </Suspense>
    </div>
  );
}
