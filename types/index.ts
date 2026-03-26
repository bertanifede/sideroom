export interface PartyTheme {
  bg: string;
  fg: string;
  accent: string;
  surface: string;
  font?: string;
}

export interface Party {
  id: string;
  invite_code: string;
  artist_id: string;
  title: string;
  description: string | null;
  seat_limit: number;
  scheduled_at: string;
  ended_at: string | null;
  files_deleted: boolean;
  payment_status: "pending" | "paid" | "refunded";
  file_path: string | null;
  file_name: string | null;
  cover_image_path?: string | null;
  theme?: PartyTheme | null;
  playback_state?: PlaybackState | null;
  created_at: string;
}

export interface Seat {
  id: string;
  party_id: string;
  guest_name: string;
  guest_token: string;
  avatar: string | null;
  joined_at: string;
  left_at: string | null;
}

export interface ChatMessage {
  id: string;
  party_id: string;
  seat_id: string;
  sender_name: string;
  text: string;
  sent_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Track {
  id: string;
  party_id: string;
  position: number;
  file_path: string;
  file_name: string;
  duration: number | null;
  created_at: string;
}

export interface PlaybackState {
  track_position: number;  // 1-indexed track
  position: number;        // seconds into track
  is_playing: boolean;
  updated_at: string;      // ISO timestamp
}

// Realtime event types
export type PlaybackEvent =
  | { type: "PLAY"; position: number; track_position: number }
  | { type: "PAUSE"; position: number }
  | { type: "SEEK"; position: number }
  | { type: "HEARTBEAT"; position: number; track_position: number; is_playing: boolean };

export type ChatEvent = {
  type: "CHAT";
  message: ChatMessage;
};

export interface Feedback {
  id: string;
  party_id: string;
  seat_id: string;
  guest_name: string;
  message: string;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  notification_email: string | null;
  created_at: string;
}

export interface HostFeedback {
  id: string;
  party_id: string;
  artist_id: string;
  rating: number;
  message: string | null;
  created_at: string;
}

export interface TrackAnnotation {
  id: string;
  party_id: string;
  track_id: string;
  seat_id: string | null;
  author_name: string;
  timestamp_sec: number;
  text: string;
  is_live_reaction: boolean;
  created_at: string;
}

export type PartyEvent = PlaybackEvent | ChatEvent;
