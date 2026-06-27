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
      golf_courses: {
        Row: {
          id: string; name: string; city: string; country: string
          lat: number; lng: number; holes_count: number; par: number
          website: string | null; timezone: string; created_at: string
        }
        Insert: {
          id?: string; name: string; city: string; country: string
          lat: number; lng: number; holes_count?: number; par?: number
          website?: string | null; timezone?: string
        }
        Update: Partial<Database["public"]["Tables"]["golf_courses"]["Insert"]>
      }
      course_holes: {
        Row: {
          id: string; course_id: string; hole_number: number
          par: number; handicap: number; notes: string | null
        }
        Insert: {
          id?: string; course_id: string; hole_number: number
          par: number; handicap: number; notes?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["course_holes"]["Insert"]>
      }
      tee_boxes: {
        Row: {
          id: string; hole_id: string; color: string
          lat: number; lng: number; yardage: number
        }
        Insert: {
          id?: string; hole_id: string; color: string
          lat: number; lng: number; yardage: number
        }
        Update: Partial<Database["public"]["Tables"]["tee_boxes"]["Insert"]>
      }
      greens: {
        Row: {
          id: string; hole_id: string
          center_lat: number; center_lng: number
          front_lat: number;  front_lng: number
          back_lat: number;   back_lng: number
          pin_lat: number | null; pin_lng: number | null
          polygon: Json | null; depth_yards: number; width_yards: number
        }
        Insert: {
          id?: string; hole_id: string
          center_lat: number; center_lng: number
          front_lat: number;  front_lng: number
          back_lat: number;   back_lng: number
          pin_lat?: number | null; pin_lng?: number | null
          polygon?: Json | null; depth_yards?: number; width_yards?: number
        }
        Update: Partial<Database["public"]["Tables"]["greens"]["Insert"]>
      }
      hazards: {
        Row: {
          id: string; hole_id: string
          type: "bunker" | "water" | "dogleg" | "layup" | "ob" | "trees"
          label: string | null; lat: number | null; lng: number | null
          geometry: Json | null; carry_yards_from_tee: number | null
        }
        Insert: {
          id?: string; hole_id: string
          type: "bunker" | "water" | "dogleg" | "layup" | "ob" | "trees"
          label?: string | null; lat?: number | null; lng?: number | null
          geometry?: Json | null; carry_yards_from_tee?: number | null
        }
        Update: Partial<Database["public"]["Tables"]["hazards"]["Insert"]>
      }
      active_rounds: {
        Row: {
          id: string; course_id: string; session_id: string
          current_hole: number; player_lat: number | null; player_lng: number | null
          unit: "yards" | "meters"; started_at: string; updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string; course_id: string; session_id: string
          current_hole?: number; player_lat?: number | null; player_lng?: number | null
          unit?: "yards" | "meters"
        }
        Update: Partial<Database["public"]["Tables"]["active_rounds"]["Insert"]>
      }
      round_hole_states: {
        Row: {
          id: string; round_id: string; hole_number: number
          score: number | null; putts: number | null
          fairway_hit: boolean | null; gir: boolean | null; notes: string | null
        }
        Insert: {
          id?: string; round_id: string; hole_number: number
          score?: number | null; putts?: number | null
          fairway_hit?: boolean | null; gir?: boolean | null; notes?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["round_hole_states"]["Insert"]>
      }
      shots: {
        Row: {
          id: string; round_id: string; hole_number: number; shot_number: number
          start_lat: number; start_lng: number
          end_lat: number | null; end_lng: number | null
          distance_yards: number | null; club_used: string | null
          started_at: string; ended_at: string | null
        }
        Insert: {
          id?: string; round_id: string; hole_number: number; shot_number?: number
          start_lat: number; start_lng: number
          end_lat?: number | null; end_lng?: number | null
          distance_yards?: number | null; club_used?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["shots"]["Insert"]>
      }
    }
    Views:     { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums:     { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
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
