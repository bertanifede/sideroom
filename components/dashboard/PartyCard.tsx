"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MoreVertical } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Party } from "@/types";

interface PartyCardProps {
  party: Party;
  coverUrl: string | null;
  isPast?: boolean;
  feedbackCount?: number;
}

export function PartyCard({ party, coverUrl, isPast, feedbackCount }: PartyCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);
  const themeColors = party.theme
    ? `linear-gradient(135deg, ${party.theme.bg}, ${party.theme.accent})`
    : "linear-gradient(135deg, #0c51da, #4a9aff)";

  return (
    <Link
      href={isPast ? `/dashboard/party/${party.id}` : `/party/${party.invite_code}`}
      className={`group block rounded-xl overflow-hidden bg-surface border border-surface-border hover:border-text-tertiary transition-all ${
        isPast ? "opacity-50" : ""
      }`}
    >
      {/* Cover image */}
      <div className="relative aspect-square overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={party.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: themeColors }}
          />
        )}
        {isPast ? (
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            <div className="px-2 py-0.5 rounded-full bg-brand-blue/80 backdrop-blur-sm border border-surface-border text-xs text-text-primary">
              Past
            </div>
            {party.files_deleted && (
              <div className="px-2 py-0.5 rounded-full bg-brand-blue/80 backdrop-blur-sm border border-surface-border text-xs text-text-primary">
                Tracks Removed
              </div>
            )}
          </div>
        ) : (
          <div ref={menuRef} className="absolute top-2 right-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="p-1.5 rounded-full bg-black/40 text-text-primary
                         hover:bg-black/60 transition-colors"
            >
              <MoreVertical className="size-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-40 rounded-lg bg-brand-blue/90 backdrop-blur-sm border border-surface-border shadow-xl overflow-hidden z-50">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    router.push(`/dashboard/party/${party.id}/edit`);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const url = `${window.location.origin}/party/${party.invite_code}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Invite link copied");
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover transition-colors"
                >
                  Copy invite link
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-text-primary truncate">{party.title}</h3>
            <p className="text-sm text-text-secondary mt-1">
              {party.seat_limit} seats &middot;{" "}
              {new Date(party.scheduled_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 mt-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = `${window.location.origin}/party/${party.invite_code}`;
                navigator.clipboard.writeText(url);
                toast.success("Invite link copied");
              }}
              className="text-xs text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              title="Copy invite link"
            >
              /{party.invite_code}
            </button>
            {isPast && feedbackCount ? (
              <span className="text-xs text-primary">
                {feedbackCount} note{feedbackCount !== 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
