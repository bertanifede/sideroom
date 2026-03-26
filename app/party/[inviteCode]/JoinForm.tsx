"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import GuestAvatar from "@/components/party/GuestAvatar";

interface JoinFormProps {
  partyId: string;
  partyTitle: string;
  scheduledAt: string;
  seatsAvailable: number;
  seatLimit: number;
  hasPin: boolean;
}

function CountdownDisplay({ scheduledAt }: { scheduledAt: string }) {
  const scheduled = new Date(scheduledAt);
  const now = new Date();
  const startsInMs = scheduled.getTime() - now.getTime();
  const hasStarted = startsInMs <= 0;

  if (hasStarted) {
    return (
      <div className="text-sm text-emerald-400">
        Party Is Live — Join Now
      </div>
    );
  }

  return (
    <div className="text-sm text-text-secondary">
      starts{" "}
      {scheduled.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })}{" "}
      at{" "}
      {scheduled.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })}
    </div>
  );
}

export default function JoinForm({
  partyId,
  partyTitle,
  scheduledAt,
  seatsAvailable,
  seatLimit,
  hasPin,
}: JoinFormProps) {
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [pinVerified, setPinVerified] = useState(!hasPin);
  const [pinInput, setPinInput] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const router = useRouter();

  async function handleVerifyPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinInput.trim()) return;

    setVerifyingPin(true);
    setError("");

    try {
      const res = await fetch(`/api/party/${partyId}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Verification failed");
      }

      setPinVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setVerifyingPin(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setJoining(true);
    setError("");

    try {
      const res = await fetch(`/api/party/${partyId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: name.trim(),
          turnstile_token: turnstileToken,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not join");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setJoining(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Party info */}
      <div>
        <h1 className="text-3xl font-bold mb-2">{partyTitle}</h1>
        <CountdownDisplay scheduledAt={scheduledAt} />
      </div>

      {/* Seats info */}
      <div className="text-sm text-text-tertiary">
        {seatsAvailable > 0 ? (
          <span>
            {seatsAvailable} of {seatLimit} seats available
          </span>
        ) : (
          <span className="text-destructive">Party Is Full</span>
        )}
      </div>

      {!pinVerified ? (
        <form onSubmit={handleVerifyPin} className="space-y-6">
          <div>
            <label className="block text-xs text-text-tertiary mb-2">
              This Party Requires a Passcode
            </label>
            <input
              type="text"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter Passcode"
              required
              maxLength={8}
              className="w-full px-4 py-3 bg-surface-inset border border-surface-border rounded-lg
                         text-text-primary text-center placeholder:text-text-tertiary focus:outline-none focus:border-text-tertiary"
            />
          </div>
          <button
            type="submit"
            disabled={!pinInput.trim() || verifyingPin}
            className="w-full px-4 py-3 bg-surface border border-surface-border text-text-primary rounded-lg font-medium
                       hover:bg-surface-hover transition-colors disabled:opacity-40"
          >
            {verifyingPin ? "Verifying..." : "Continue"}
          </button>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
      ) : seatsAvailable > 0 ? (
        <form onSubmit={handleJoin} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs text-text-tertiary mb-2">Your Name</label>
            {name.trim() && (
              <div className="flex justify-center mb-3">
                <GuestAvatar name={name.trim()} size={48} />
              </div>
            )}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Your Name"
              required
              maxLength={50}
              className="w-full px-4 py-3 bg-surface-inset border border-surface-border rounded-lg
                         text-text-primary text-center placeholder:text-text-tertiary focus:outline-none focus:border-text-tertiary"
            />
          </div>

          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onSuccess={(token) => { setTurnstileToken(token); setTurnstileReady(true); }}
              onError={() => setTurnstileReady(true)}
              onExpire={() => { setTurnstileToken(null); setTurnstileReady(true); }}
              options={{ size: "invisible" }}
            />
          )}

          <button
            type="submit"
            disabled={!name.trim() || joining || !turnstileReady}
            className="w-full px-4 py-3 bg-surface border border-surface-border text-text-primary rounded-lg font-medium
                       hover:bg-surface-hover transition-colors disabled:opacity-40"
          >
            {joining ? "Joining..." : "Join the Party"}
          </button>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>
      ) : (
        <p className="text-text-tertiary">All seats are taken. Check back later.</p>
      )}
    </div>
  );
}
