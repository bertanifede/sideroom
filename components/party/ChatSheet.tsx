"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X } from "lucide-react";
import ChatPanel from "./ChatPanel";
import { ChatMessage } from "@/types";
import { PresenceUser } from "@/hooks/useRealtimeChannel";

interface ChatSheetProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  currentUserName: string;
  disabled?: boolean;
  presenceState?: PresenceUser[];
}

export default function ChatSheet({
  messages,
  onSend,
  currentUserName,
  disabled,
  presenceState,
}: ChatSheetProps) {
  const [open, setOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessageCountRef = useRef(messages.length);

  // Track unread messages when panel is closed
  useEffect(() => {
    const newMessages = messages.length - prevMessageCountRef.current;
    if (newMessages > 0 && !open) {
      setUnreadCount((prev) => prev + newMessages);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, open]);

  // Reset unread when panel opens
  useEffect(() => {
    if (open) {
      setUnreadCount(0);
    }
  }, [open]);

  return (
    <>
      {/* Floating toggle button — only visible when panel is closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-20 flex items-center justify-center
                     w-12 h-12 bg-[var(--party-surface)]/60 backdrop-blur-xl hover:bg-[var(--party-surface)]/80 rounded-full shadow-lg
                     transition-colors"
        >
          <MessageCircle className="w-5 h-5 text-[var(--party-fg)]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white
                             text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Floating chat panel */}
      {open && (
        <div
          className="fixed z-20
                     inset-0 sm:inset-auto
                     sm:right-4 sm:bottom-4 sm:top-auto sm:left-auto
                     sm:w-80 sm:h-[28rem]
                     sm:rounded-2xl sm:shadow-lg sm:shadow-black/10
                     bg-[var(--party-surface)]/40 backdrop-blur-2xl border border-[var(--party-fg)]/10
                     flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--party-fg)]/10">
            <span className="text-sm font-medium text-[var(--party-fg)]">Chat</span>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full
                         hover:bg-[var(--party-surface)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--party-fg)]/60" />
            </button>
          </div>

          {/* Chat content */}
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              messages={messages}
              onSend={onSend}
              currentUserName={currentUserName}
              disabled={disabled}
              presenceState={presenceState}
            />
          </div>
        </div>
      )}
    </>
  );
}
