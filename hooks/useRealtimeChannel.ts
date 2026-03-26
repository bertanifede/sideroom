"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  guest_name: string;
  avatar_url?: string | null;
}

export function useRealtimeChannel(partyId: string, guestName: string, avatarUrl?: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [presenceState, setPresenceState] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`party:${partyId}`, {
      config: { presence: { key: guestName } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users = Object.values(state)
          .flat()
          .map((p) => {
            const presence = p as unknown as PresenceUser;
            return {
              guest_name: presence.guest_name,
              avatar_url: presence.avatar_url ?? null,
            };
          });
        setPresenceState(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ guest_name: guestName, avatar_url: avatarUrl ?? null });
          setIsConnected(true);
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [partyId, guestName, avatarUrl]);

  return { channel: channelRef.current, presenceState, isConnected };
}
