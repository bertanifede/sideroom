"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star, Clock, Trash2, MessageSquare } from "lucide-react";

interface PartySummary {
  partyId: string;
  title: string;
  coverUrl: string | null;
  attendeeCount: number;
  feedbackCount: number;
  existingFeedback: { rating: number; message: string | null } | null;
}

interface PostPartySummaryDialogProps {
  summary: PartySummary;
}

export function PostPartySummaryDialog({ summary }: PostPartySummaryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [rating, setRating] = useState(summary.existingFeedback?.rating ?? 0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(!!summary.existingFeedback);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setOpen(false);
    router.replace("/dashboard");
  }

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/party/${summary.partyId}/host-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, message: message.trim() || null }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleInfoClick(event: string) {
    window.dispatchEvent(new Event(event));
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="max-w-5xl p-0 gap-0 rounded-3xl border border-surface-border text-text-primary overflow-hidden bg-brand-blue/90 backdrop-blur-xl"
      >
        <DialogTitle className="sr-only">Party Summary</DialogTitle>
        <div className="flex flex-col md:flex-row md:min-h-[500px]">
          {/* Left column */}
          <div className="flex-1 p-6 md:p-10 flex flex-col items-center md:items-start gap-4 md:gap-6">
            {summary.coverUrl && (
              <img
                src={summary.coverUrl}
                alt={summary.title}
                className="w-32 h-32 md:w-48 md:h-48 rounded-2xl object-cover ring-1 ring-surface-border"
              />
            )}

            <div className="text-center md:text-left">
              <p className="text-sm md:text-base text-text-secondary mb-1 md:mb-2">Your Listening Party Has Ended</p>
              <h3 className="text-xl md:text-2xl font-bold">{summary.title}</h3>
              <p className="text-sm md:text-base text-text-secondary mt-1 md:mt-2">
                {summary.attendeeCount} listener{summary.attendeeCount !== 1 ? "s" : ""} attended
              </p>
            </div>

            <div className="space-y-2 md:space-y-3 w-full mt-2 md:mt-4">
              <button
                type="button"
                onClick={() => handleInfoClick("show-past-parties")}
                className="flex items-center gap-2 md:gap-3 text-sm md:text-base text-text-secondary hover:text-white transition-colors focus:outline-none"
              >
                <Clock className="w-4 h-4 md:w-5 md:h-5 text-text-tertiary" />
                Now in your Past tab
              </button>
              <div className="flex items-center gap-2 md:gap-3 text-sm md:text-base text-text-secondary">
                <Trash2 className="w-4 h-4 md:w-5 md:h-5 text-text-tertiary" />
                Tracks deleted in 48h
              </div>
              {summary.feedbackCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleInfoClick("show-notes-tab")}
                  className="flex items-center gap-2 md:gap-3 text-sm md:text-base text-text-secondary hover:text-white transition-colors focus:outline-none"
                >
                  <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-text-tertiary" />
                  {summary.feedbackCount} listener note{summary.feedbackCount !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="flex-1 p-6 md:p-10 border-t md:border-t-0 md:border-l border-surface-border">
            <div
              className="rounded-2xl p-5 md:p-8 h-full flex flex-col bg-surface-inset border border-surface-border"
            >
              {submitted ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <p className="text-sm md:text-base text-text-secondary">Thanks for your feedback!</p>
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-6 h-6 md:w-7 md:h-7 ${
                          star <= (summary.existingFeedback?.rating ?? rating)
                            ? "text-white fill-white"
                            : "text-text-tertiary"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm md:text-base font-medium mb-3 md:mb-4">Rate your experience</p>
                  <div
                    className="flex gap-1.5 md:gap-2 mb-4 md:mb-6"
                    onMouseLeave={() => setHoveredStar(0)}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredStar(star)}
                        className="p-0.5 md:p-1 transition-transform hover:scale-110 focus:outline-none"
                      >
                        <Star
                          className={`w-7 h-7 md:w-8 md:h-8 pointer-events-none ${
                            star <= (hoveredStar || rating)
                              ? "text-white fill-white"
                              : "text-text-tertiary"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                    rows={4}
                    placeholder="How can we improve?"
                    className="w-full rounded-xl px-4 py-3 text-sm md:text-base text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:border-text-tertiary mb-4 md:mb-6 md:flex-1 md:rows-6 bg-surface-inset border border-surface-border"
                  />
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={rating === 0 || submitting}
                    className="ml-auto px-6 py-2.5 bg-surface border border-surface-border text-text-primary text-sm font-medium rounded-full hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
