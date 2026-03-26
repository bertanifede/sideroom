"use client";

import { useEffect, useState, useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { ChatMessage, ChatEvent } from "@/types";

interface UsePartyChatProps {
  channel: RealtimeChannel | null;
  partyId: string;
  seatId: string;
  senderName: string;
}

export function usePartyChat({
  channel,
  partyId,
  seatId,
  senderName,
}: UsePartyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!channel || !text.trim()) return;

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        party_id: partyId,
        seat_id: seatId,
        sender_name: senderName,
        text: text.trim().slice(0, 500),
        sent_at: new Date().toISOString(),
      };

      // Broadcast to all listeners
      channel.send({
        type: "broadcast",
        event: "chat",
        payload: { type: "CHAT", message } as ChatEvent,
      });

      // Add to local state immediately
      setMessages((prev) => [...prev, message]);
    },
    [channel, partyId, seatId, senderName]
  );

  // Listen for chat messages
  useEffect(() => {
    if (!channel) return;

    const handleChat = (payload: { payload: ChatEvent }) => {
      const msg = payload.payload.message;
      // Don't duplicate our own messages
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    channel.on("broadcast", { event: "chat" }, handleChat);

    // No cleanup needed — channel cleanup is handled by useRealtimeChannel
  }, [channel]);

  return { messages, sendMessage };
}
