"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Party, Feedback } from "@/types";
import { PartyCard } from "./PartyCard";
import { PartyFeedbackList } from "./PartyFeedbackList";
import { WelcomeCanvas } from "./WelcomeCanvas";

interface DashboardContentProps {
  activeParties: Party[];
  pastParties: Party[];
  coverUrls: Record<string, string | null>;
  partiesWithFeedback?: Party[];
  feedbackByParty?: Record<string, Feedback[]>;
  isFirstTime?: boolean;
}

export function DashboardContent({
  activeParties,
  pastParties,
  coverUrls,
  partiesWithFeedback = [],
  feedbackByParty = {},
  isFirstTime = false,
}: DashboardContentProps) {
  const [tab, setTab] = useState<"active" | "past" | "notes">("active");
  useEffect(() => {
    function handleShowPast() {
      setTab("past");
    }
    function handleShowNotes() {
      setTab("notes");
    }
    window.addEventListener("show-past-parties", handleShowPast);
    window.addEventListener("show-notes-tab", handleShowNotes);
    return () => {
      window.removeEventListener("show-past-parties", handleShowPast);
      window.removeEventListener("show-notes-tab", handleShowNotes);
    };
  }, []);
  const hasPast = pastParties.length > 0;
  const hasNotes = partiesWithFeedback.length > 0;

  if (isFirstTime) {
    return (
      <main className="flex-1 flex flex-col">
        <WelcomeCanvas />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-6 py-8">
      {/* Tabs */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`text-lg font-medium transition-colors cursor-pointer ${
            tab === "active" ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          Your Parties
        </button>
        {hasPast && (
          <>
            <span className="text-surface-border">/</span>
            <button
              type="button"
              onClick={() => setTab("past")}
              className={`text-lg font-medium transition-colors cursor-pointer ${
                tab === "past" ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Past
            </button>
          </>
        )}
        {hasNotes && (
          <>
            <span className="text-surface-border">/</span>
            <button
              type="button"
              onClick={() => setTab("notes")}
              className={`text-lg font-medium transition-colors cursor-pointer ${
                tab === "notes" ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Notes
            </button>
          </>
        )}
      </div>

      {/* Active parties */}
      <div className={`${tab === "active" ? "" : "hidden"} ${activeParties.length === 0 ? "flex-1 flex flex-col -mx-6 -mb-8" : ""}`}>
        {activeParties.length === 0 ? (
          <WelcomeCanvas
            headline="No upcoming parties"
            subheadline="Start a new one"
            ctaLabel="+ New Party"
            fast
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeParties.map((party) => (
              <PartyCard
                key={party.id}
                party={party}
                coverUrl={coverUrls[party.id] ?? null}
              />
            ))}
          </div>
        )}
      </div>

      {/* Past parties — always rendered so images are pre-fetched */}
      {hasPast && (
        <div className={tab === "past" ? "" : "hidden"}>
          {pastParties.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-32">
              <p className="text-text-secondary">No past parties.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pastParties.map((party) => (
                <PartyCard
                  key={party.id}
                  party={party}
                  coverUrl={coverUrls[party.id] ?? null}
                  isPast
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes tab — feedback grouped by party */}
      {hasNotes && (
        <div className={tab === "notes" ? "" : "hidden"}>
          <div className="space-y-8">
            {partiesWithFeedback.map((party) => (
              <div key={party.id}>
                <div className="flex items-center gap-3 mb-3">
                  {coverUrls[party.id] && (
                    <img
                      src={coverUrls[party.id]!}
                      alt={party.title}
                      className="w-10 h-10 rounded-md object-cover"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-text-primary">{party.title}</h3>
                    <p className="text-xs text-text-secondary">
                      {new Date(party.scheduled_at).toLocaleDateString()} &middot;{" "}
                      {feedbackByParty[party.id]?.length ?? 0} note{(feedbackByParty[party.id]?.length ?? 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <PartyFeedbackList feedback={feedbackByParty[party.id] ?? []} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating New Party button — hidden when active tab has no parties (canvas CTA replaces it) */}
      {!(tab === "active" && activeParties.length === 0) && (
        <Link
          href="/create-party"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 border border-surface-border bg-surface rounded-full font-medium font-pixel hover:bg-brand-blue transition-colors cursor-pointer"
        >
          + New Party
        </Link>
      )}
    </main>
  );
}
