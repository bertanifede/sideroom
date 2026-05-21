"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Smile } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChatMessage } from "@/types";
import { PresenceUser } from "@/hooks/useRealtimeChannel";
import GuestAvatar from "@/components/party/GuestAvatar";

const PartyEmojiPicker = dynamic(
  () => import("@/components/party/PartyEmojiPicker"),
  { ssr: false, loading: () => <div className="w-[280px] h-[300px]" /> }
);

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  currentUserName: string;
  disabled?: boolean;
  presenceState?: PresenceUser[];
}

export default function ChatPanel({
  messages,
  onSend,
  currentUserName,
  disabled = false,
  presenceState,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxInputH, setMaxInputH] = useState(128);

  // Measure container and set textarea max-height to 50% of panel
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setMaxInputH(Math.max(80, Math.floor(entry.contentRect.height * 0.5)));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [text]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
  }

  const [mounted, setMounted] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  function handleEmojiSelect(native: string) {
    setText((prev) => prev + native);
    setEmojiOpen(false);
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-4
        [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.length === 0 && (
          <p className="text-[var(--party-fg)]/40 text-sm text-center mt-8">
            {disabled
              ? "Chat will be available during the party"
              : "No messages yet. Say something."}
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_name === currentUserName;
          const sender = presenceState?.find((u) => u.guest_name === msg.sender_name);
          return (
            <div key={msg.id} className="flex items-start gap-2.5">
              {/* Avatar */}
              <div className="shrink-0 w-8 h-8 mt-0.5">
                {sender?.avatar_url ? (
                  <img
                    src={sender.avatar_url}
                    alt={msg.sender_name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <GuestAvatar name={msg.sender_name} size={32} />
                )}
              </div>
              {/* Name + message */}
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-[var(--party-fg)]/60">
                  {msg.sender_name}
                </span>
                <p className="text-sm text-[var(--party-fg)] mt-0.5">
                  {msg.text.split("\n").map((line, i, arr) => (
                    <span key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2">
        <div className="relative bg-[var(--party-surface)] border border-[var(--party-fg)]/10 rounded-lg transition-colors">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={disabled ? "Chat will be available during the party" : "Say something..."}
            maxLength={500}
            disabled={disabled}
            rows={1}
            style={{ maxHeight: maxInputH }}
            className="w-full pl-3.5 pr-10 py-2.5 bg-transparent text-[var(--party-fg)] text-base md:text-sm
                       placeholder-[var(--party-fg)]/40 focus:outline-none focus:ring-0
                       disabled:cursor-not-allowed resize-none overflow-y-auto
                       [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          />
          {/* Emoji button inside input, vertically centered right */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {mounted ? (
              <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex items-center justify-center w-7 h-7 rounded-full
                               hover:bg-[var(--party-fg)]/10 transition-colors disabled:opacity-40"
                  >
                    <Smile className="w-[18px] h-[18px] text-[var(--party-fg)]/40 hover:text-[var(--party-fg)]/60 transition-colors" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="end"
                  sideOffset={8}
                  className="w-auto !p-0 !bg-transparent !shadow-none"
                  style={{ border: "none", background: "transparent" }}
                >
                  <PartyEmojiPicker onSelect={handleEmojiSelect} />
                </PopoverContent>
              </Popover>
            ) : (
              <div className="w-7 h-7 flex items-center justify-center">
                <Smile className="w-[18px] h-[18px] text-[var(--party-fg)]/40" />
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
