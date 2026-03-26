export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      feedback: {
        Row: {
          created_at: string | null
          guest_name: string
          id: string
          message: string
          party_id: string
          seat_id: string
        }
        Insert: {
          created_at?: string | null
          guest_name: string
          id?: string
          message: string
          party_id: string
          seat_id: string
        }
        Update: {
          created_at?: string | null
          guest_name?: string
          id?: string
          message?: string
          party_id?: string
          seat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          artist_id: string
          cover_image_path: string | null
          created_at: string | null
          description: string | null
          ended_at: string | null
          file_name: string | null
          file_path: string | null
          files_deleted: boolean | null
          id: string
          invite_code: string
          payment_status: string
          playback_state: Json | null
          scheduled_at: string
          seat_limit: number
          stripe_session_id: string | null
          theme: Json | null
          title: string
        }
        Insert: {
          artist_id: string
          cover_image_path?: string | null
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          file_name?: string | null
          file_path?: string | null
          files_deleted?: boolean | null
          id?: string
          invite_code: string
          payment_status?: string
          playback_state?: Json | null
          scheduled_at: string
          seat_limit?: number
          stripe_session_id?: string | null
          theme?: Json | null
          title: string
        }
        Update: {
          artist_id?: string
          cover_image_path?: string | null
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          file_name?: string | null
          file_path?: string | null
          files_deleted?: boolean | null
          id?: string
          invite_code?: string
          payment_status?: string
          playback_state?: Json | null
          scheduled_at?: string
          seat_limit?: number
          stripe_session_id?: string | null
          theme?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      party_secrets: {
        Row: {
          party_id: string
          pin_hash: string | null
        }
        Insert: {
          party_id: string
          pin_hash?: string | null
        }
        Update: {
          party_id?: string
          pin_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "party_secrets_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: true
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_checkouts: {
        Row: {
          artist_id: string
          created_at: string | null
          id: string
          party_data: Json
          stripe_session_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string | null
          id?: string
          party_data: Json
          stripe_session_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string | null
          id?: string
          party_data?: Json
          stripe_session_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      seats: {
        Row: {
          avatar: string | null
          guest_name: string
          guest_token: string
          id: string
          joined_at: string | null
          left_at: string | null
          party_id: string
        }
        Insert: {
          avatar?: string | null
          guest_name: string
          guest_token: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          party_id: string
        }
        Update: {
          avatar?: string | null
          guest_name?: string
          guest_token?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          party_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seats_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          user_id: string
          notification_email: string | null
          created_at: string | null
        }
        Insert: {
          user_id: string
          notification_email?: string | null
          created_at?: string | null
        }
        Update: {
          user_id?: string
          notification_email?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      tracks: {
        Row: {
          created_at: string | null
          duration: number | null
          file_name: string
          file_path: string
          id: string
          party_id: string
          position: number
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          file_name: string
          file_path: string
          id?: string
          party_id: string
          position: number
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          file_name?: string
          file_path?: string
          id?: string
          party_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "tracks_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_seat: {
        Args: {
          p_guest_name: string
          p_guest_token: string
          p_party_id: string
        }
        Returns: {
          reason: string
          seat_id: string
          success: boolean
        }[]
      }
      cleanup_expired_party_audio: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
