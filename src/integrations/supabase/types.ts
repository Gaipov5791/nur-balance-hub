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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      buddy_blocks: {
        Row: {
          blocked_user_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      buddy_matches: {
        Row: {
          created_at: string
          ended_at: string | null
          ended_by: string | null
          id: string
          life_status: string | null
          status: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          life_status?: string | null
          status?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          life_status?: string | null
          status?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      buddy_messages: {
        Row: {
          body: string
          created_at: string
          duration_seconds: number
          id: string
          kind: string
          match_id: string
          media_path: string | null
          sender_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          kind?: string
          match_id: string
          media_path?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          kind?: string
          match_id?: string
          media_path?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "buddy_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_queue: {
        Row: {
          created_at: string
          life_status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          life_status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          life_status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      buddy_reports: {
        Row: {
          created_at: string
          details: string
          id: string
          match_id: string | null
          reason: string
          reported_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          match_id?: string | null
          reason: string
          reported_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          match_id?: string | null
          reason?: string
          reported_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_reports_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "buddy_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_transactions: {
        Row: {
          action: string
          amount: number
          created_at: string
          entry_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          amount: number
          created_at?: string
          entry_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          amount?: number
          created_at?: string
          entry_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_transactions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          duration_seconds: number
          entry_date: string
          file_size: number
          id: string
          level: number
          mime_type: string | null
          mood: string
          note: string
          thumbnail_path: string | null
          user_id: string
          video_path: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          entry_date?: string
          file_size?: number
          id?: string
          level?: number
          mime_type?: string | null
          mood: string
          note?: string
          thumbnail_path?: string | null
          user_id: string
          video_path?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          entry_date?: string
          file_size?: number
          id?: string
          level?: number
          mime_type?: string | null
          mood?: string
          note?: string
          thumbnail_path?: string | null
          user_id?: string
          video_path?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          coins: number
          created_at: string
          goal: string | null
          id: string
          last_entry_date: string | null
          life_status: string | null
          name: string
          onboarded: boolean
          pin_code: string | null
          streak: number
          updated_at: string
        }
        Insert: {
          coins?: number
          created_at?: string
          goal?: string | null
          id: string
          last_entry_date?: string | null
          life_status?: string | null
          name?: string
          onboarded?: boolean
          pin_code?: string | null
          streak?: number
          updated_at?: string
        }
        Update: {
          coins?: number
          created_at?: string
          goal?: string | null
          id?: string
          last_entry_date?: string | null
          life_status?: string | null
          name?: string
          onboarded?: boolean
          pin_code?: string | null
          streak?: number
          updated_at?: string
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          cost: number
          created_at: string
          id: string
          reward_id: string
          title: string
          user_id: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          reward_id: string
          title: string
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          reward_id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      therapist_requests: {
        Row: {
          admin_note: string
          client_name: string
          contact: string
          created_at: string
          id: string
          preferred_time: string
          status: string
          therapist_id: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string
          client_name?: string
          contact?: string
          created_at?: string
          id?: string
          preferred_time?: string
          status?: string
          therapist_id: string
          topic?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string
          client_name?: string
          contact?: string
          created_at?: string
          id?: string
          preferred_time?: string
          status?: string
          therapist_id?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_requests_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      therapists: {
        Row: {
          bio: string
          contact_email: string | null
          created_at: string
          experience: string
          id: string
          initials: string
          is_active: boolean
          is_verified: boolean
          languages: string
          name: string
          photo_url: string | null
          price_label: string
          sort_order: number
          spec: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string
          contact_email?: string | null
          created_at?: string
          experience?: string
          id?: string
          initials?: string
          is_active?: boolean
          is_verified?: boolean
          languages?: string
          name: string
          photo_url?: string | null
          price_label?: string
          sort_order?: number
          spec?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string
          contact_email?: string | null
          created_at?: string
          experience?: string
          id?: string
          initials?: string
          is_active?: boolean
          is_verified?: boolean
          languages?: string
          name?: string
          photo_url?: string | null
          price_label?: string
          sort_order?: number
          spec?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_buddy_match: {
        Args: never
        Returns: {
          match_id: string
          partner_id: string
          partner_name: string
          partner_status: string
          started_at: string
        }[]
      }
      find_or_queue_buddy: {
        Args: { _life_status: string }
        Returns: {
          match_id: string
          matched: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_match_participant: {
        Args: { _match_id: string; _user_id: string }
        Returns: boolean
      }
      leave_buddy_match: {
        Args: { _block?: boolean; _match_id: string }
        Returns: boolean
      }
      leave_buddy_queue: { Args: never; Returns: boolean }
      report_buddy: {
        Args: { _details?: string; _match_id: string; _reason: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "therapist"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "therapist"],
    },
  },
} as const
