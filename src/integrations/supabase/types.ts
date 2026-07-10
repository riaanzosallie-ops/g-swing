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
      course_sync_history: {
        Row: {
          accepted: Json
          changes: Json
          course_map_id: string | null
          external_course_id: string | null
          id: string
          notes: string | null
          owner_id: string | null
          provider: string
          rejected: Json
          synced_at: string
        }
        Insert: {
          accepted?: Json
          changes?: Json
          course_map_id?: string | null
          external_course_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          provider: string
          rejected?: Json
          synced_at?: string
        }
        Update: {
          accepted?: Json
          changes?: Json
          course_map_id?: string | null
          external_course_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          provider?: string
          rejected?: Json
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sync_history_course_map_id_fkey"
            columns: ["course_map_id"]
            isOneToOne: false
            referencedRelation: "gswing_course_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      gi_courses: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          detail: Json | null
          detail_fetched_at: string | null
          gi_course_id: string
          gps: Json | null
          gps_fetched_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          scorecard: Json | null
          scorecard_fetched_at: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          detail?: Json | null
          detail_fetched_at?: string | null
          gi_course_id: string
          gps?: Json | null
          gps_fetched_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          scorecard?: Json | null
          scorecard_fetched_at?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          detail?: Json | null
          detail_fetched_at?: string | null
          gi_course_id?: string
          gps?: Json | null
          gps_fetched_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          scorecard?: Json | null
          scorecard_fetched_at?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gi_credit_log: {
        Row: {
          action: string
          created_at: string
          credits_estimated: number
          gi_course_id: string | null
          hole_number: number | null
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          credits_estimated?: number
          gi_course_id?: string | null
          hole_number?: number | null
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          credits_estimated?: number
          gi_course_id?: string | null
          hole_number?: number | null
          id?: string
        }
        Relationships: []
      }
      gi_hole_assets: {
        Row: {
          asset_type: string
          fetched_at: string
          gi_course_id: string
          hole_number: number
          id: string
          payload: Json | null
          storage_path: string | null
        }
        Insert: {
          asset_type: string
          fetched_at?: string
          gi_course_id: string
          hole_number: number
          id?: string
          payload?: Json | null
          storage_path?: string | null
        }
        Update: {
          asset_type?: string
          fetched_at?: string
          gi_course_id?: string
          hole_number?: number
          id?: string
          payload?: Json | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gi_hole_assets_gi_course_id_fkey"
            columns: ["gi_course_id"]
            isOneToOne: false
            referencedRelation: "gi_courses"
            referencedColumns: ["gi_course_id"]
          },
        ]
      }
      gi_probe_log: {
        Row: {
          content_type: string | null
          feature: string
          id: string
          method: string
          path: string
          preview: string | null
          provider_request_id: string | null
          ran_at: string
          status: number | null
          verdict: string
        }
        Insert: {
          content_type?: string | null
          feature: string
          id?: string
          method: string
          path: string
          preview?: string | null
          provider_request_id?: string | null
          ran_at?: string
          status?: number | null
          verdict: string
        }
        Update: {
          content_type?: string | null
          feature?: string
          id?: string
          method?: string
          path?: string
          preview?: string | null
          provider_request_id?: string | null
          ran_at?: string
          status?: number | null
          verdict?: string
        }
        Relationships: []
      }
      gi_search_counter: {
        Row: {
          count: number
          id: number
          last_query: string | null
          updated_at: string
        }
        Insert: {
          count?: number
          id?: number
          last_query?: string | null
          updated_at?: string
        }
        Update: {
          count?: number
          id?: number
          last_query?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      golf_api_logs: {
        Row: {
          api_requests_left: string | null
          created_at: string
          endpoint: string
          error: string | null
          id: number
          latency_ms: number | null
          params: Json | null
          status: number | null
          user_id: string | null
        }
        Insert: {
          api_requests_left?: string | null
          created_at?: string
          endpoint: string
          error?: string | null
          id?: number
          latency_ms?: number | null
          params?: Json | null
          status?: number | null
          user_id?: string | null
        }
        Update: {
          api_requests_left?: string | null
          created_at?: string
          endpoint?: string
          error?: string | null
          id?: number
          latency_ms?: number | null
          params?: Json | null
          status?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      golf_courses: {
        Row: {
          city: string | null
          club: string | null
          country: string | null
          created_at: string
          external_ref: string | null
          id: string
          latitude: number | null
          location: unknown
          longitude: number | null
          name: string
          par: number | null
          timezone: string | null
          total_holes: number
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          club?: string | null
          country?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name: string
          par?: number | null
          timezone?: string | null
          total_holes?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          club?: string | null
          country?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name?: string
          par?: number | null
          timezone?: string | null
          total_holes?: number
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      golf_daily_pins: {
        Row: {
          created_at: string
          effective_date: string
          hole_id: string
          id: string
          pin_label: string
          set_by: string | null
        }
        Insert: {
          created_at?: string
          effective_date?: string
          hole_id: string
          id?: string
          pin_label: string
          set_by?: string | null
        }
        Update: {
          created_at?: string
          effective_date?: string
          hole_id?: string
          id?: string
          pin_label?: string
          set_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "golf_daily_pins_hole_id_fkey"
            columns: ["hole_id"]
            isOneToOne: false
            referencedRelation: "golf_holes"
            referencedColumns: ["id"]
          },
        ]
      }
      golf_fairway_polygons: {
        Row: {
          created_at: string
          hole_id: string
          id: string
          polygon: unknown
          updated_at: string
        }
        Insert: {
          created_at?: string
          hole_id: string
          id?: string
          polygon: unknown
          updated_at?: string
        }
        Update: {
          created_at?: string
          hole_id?: string
          id?: string
          polygon?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "golf_fairway_polygons_hole_id_fkey"
            columns: ["hole_id"]
            isOneToOne: true
            referencedRelation: "golf_holes"
            referencedColumns: ["id"]
          },
        ]
      }
      golf_green_polygons: {
        Row: {
          created_at: string
          depth_yards: number | null
          hole_id: string
          id: string
          polygon: unknown
          updated_at: string
          width_yards: number | null
        }
        Insert: {
          created_at?: string
          depth_yards?: number | null
          hole_id: string
          id?: string
          polygon: unknown
          updated_at?: string
          width_yards?: number | null
        }
        Update: {
          created_at?: string
          depth_yards?: number | null
          hole_id?: string
          id?: string
          polygon?: unknown
          updated_at?: string
          width_yards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "golf_green_polygons_hole_id_fkey"
            columns: ["hole_id"]
            isOneToOne: true
            referencedRelation: "golf_holes"
            referencedColumns: ["id"]
          },
        ]
      }
      golf_hazards: {
        Row: {
          carry_yards_from_tee: number | null
          created_at: string
          geom: unknown
          hazard_type: Database["public"]["Enums"]["golf_hazard_type"]
          hole_id: string
          id: string
          label: string | null
        }
        Insert: {
          carry_yards_from_tee?: number | null
          created_at?: string
          geom: unknown
          hazard_type: Database["public"]["Enums"]["golf_hazard_type"]
          hole_id: string
          id?: string
          label?: string | null
        }
        Update: {
          carry_yards_from_tee?: number | null
          created_at?: string
          geom?: unknown
          hazard_type?: Database["public"]["Enums"]["golf_hazard_type"]
          hole_id?: string
          id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "golf_hazards_hole_id_fkey"
            columns: ["hole_id"]
            isOneToOne: false
            referencedRelation: "golf_holes"
            referencedColumns: ["id"]
          },
        ]
      }
      golf_hole_points: {
        Row: {
          created_at: string
          hole_id: string
          id: string
          label: string | null
          location: unknown
          meta: Json
          point_type: Database["public"]["Enums"]["golf_point_type"]
        }
        Insert: {
          created_at?: string
          hole_id: string
          id?: string
          label?: string | null
          location: unknown
          meta?: Json
          point_type: Database["public"]["Enums"]["golf_point_type"]
        }
        Update: {
          created_at?: string
          hole_id?: string
          id?: string
          label?: string | null
          location?: unknown
          meta?: Json
          point_type?: Database["public"]["Enums"]["golf_point_type"]
        }
        Relationships: [
          {
            foreignKeyName: "golf_hole_points_hole_id_fkey"
            columns: ["hole_id"]
            isOneToOne: false
            referencedRelation: "golf_holes"
            referencedColumns: ["id"]
          },
        ]
      }
      golf_holes: {
        Row: {
          course_id: string
          created_at: string
          handicap: number | null
          hole_number: number
          id: string
          length_black: number | null
          length_blue: number | null
          length_gold: number | null
          length_red: number | null
          length_white: number | null
          notes: string | null
          par: number | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          handicap?: number | null
          hole_number: number
          id?: string
          length_black?: number | null
          length_blue?: number | null
          length_gold?: number | null
          length_red?: number | null
          length_white?: number | null
          notes?: string | null
          par?: number | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          handicap?: number | null
          hole_number?: number
          id?: string
          length_black?: number | null
          length_blue?: number | null
          length_gold?: number | null
          length_red?: number | null
          length_white?: number | null
          notes?: string | null
          par?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "golf_holes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "golf_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      golf_shots: {
        Row: {
          club: string | null
          course_id: string | null
          created_at: string
          distance_yards: number | null
          elevation_change_ft: number | null
          end_location: unknown
          hole_id: string | null
          hole_number: number | null
          id: string
          lie: string | null
          metadata: Json
          notes: string | null
          round_id: string | null
          shot_number: number | null
          start_location: unknown
          taken_at: string
          user_id: string | null
          wind_direction_deg: number | null
          wind_speed_mph: number | null
        }
        Insert: {
          club?: string | null
          course_id?: string | null
          created_at?: string
          distance_yards?: number | null
          elevation_change_ft?: number | null
          end_location?: unknown
          hole_id?: string | null
          hole_number?: number | null
          id?: string
          lie?: string | null
          metadata?: Json
          notes?: string | null
          round_id?: string | null
          shot_number?: number | null
          start_location?: unknown
          taken_at?: string
          user_id?: string | null
          wind_direction_deg?: number | null
          wind_speed_mph?: number | null
        }
        Update: {
          club?: string | null
          course_id?: string | null
          created_at?: string
          distance_yards?: number | null
          elevation_change_ft?: number | null
          end_location?: unknown
          hole_id?: string | null
          hole_number?: number | null
          id?: string
          lie?: string | null
          metadata?: Json
          notes?: string | null
          round_id?: string | null
          shot_number?: number | null
          start_location?: unknown
          taken_at?: string
          user_id?: string | null
          wind_direction_deg?: number | null
          wind_speed_mph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "golf_shots_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "golf_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "golf_shots_hole_id_fkey"
            columns: ["hole_id"]
            isOneToOne: false
            referencedRelation: "golf_holes"
            referencedColumns: ["id"]
          },
        ]
      }
      golfapi_clubs: {
        Row: {
          address: string | null
          cached_at: string
          city: string | null
          club_id: string
          club_name: string
          country: string | null
          country2: string | null
          latitude: number | null
          longitude: number | null
          postal_code: string | null
          raw: Json
          state: string | null
          telephone: string | null
          timestamp_updated: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          cached_at?: string
          city?: string | null
          club_id: string
          club_name: string
          country?: string | null
          country2?: string | null
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          raw: Json
          state?: string | null
          telephone?: string | null
          timestamp_updated?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          cached_at?: string
          city?: string | null
          club_id?: string
          club_name?: string
          country?: string | null
          country2?: string | null
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          raw?: Json
          state?: string | null
          telephone?: string | null
          timestamp_updated?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      golfapi_coordinates: {
        Row: {
          cached_at: string
          course_id: string
          hole: number
          id: number
          latitude: number
          location: number | null
          longitude: number
          poi: number
          side_fw: number | null
        }
        Insert: {
          cached_at?: string
          course_id: string
          hole: number
          id?: number
          latitude: number
          location?: number | null
          longitude: number
          poi: number
          side_fw?: number | null
        }
        Update: {
          cached_at?: string
          course_id?: string
          hole?: number
          id?: number
          latitude?: number
          location?: number | null
          longitude?: number
          poi?: number
          side_fw?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "golfapi_coordinates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "golfapi_courses"
            referencedColumns: ["course_id"]
          },
        ]
      }
      golfapi_courses: {
        Row: {
          cached_at: string
          club_id: string | null
          course_id: string
          course_name: string
          has_gps: boolean
          indexes_men: number[] | null
          indexes_women: number[] | null
          latitude: number | null
          longitude: number | null
          measure: string | null
          num_holes: number
          pars_men: number[] | null
          pars_women: number[] | null
          raw: Json
          timestamp_updated: number | null
          updated_at: string
        }
        Insert: {
          cached_at?: string
          club_id?: string | null
          course_id: string
          course_name: string
          has_gps?: boolean
          indexes_men?: number[] | null
          indexes_women?: number[] | null
          latitude?: number | null
          longitude?: number | null
          measure?: string | null
          num_holes?: number
          pars_men?: number[] | null
          pars_women?: number[] | null
          raw: Json
          timestamp_updated?: number | null
          updated_at?: string
        }
        Update: {
          cached_at?: string
          club_id?: string | null
          course_id?: string
          course_name?: string
          has_gps?: boolean
          indexes_men?: number[] | null
          indexes_women?: number[] | null
          latitude?: number | null
          longitude?: number | null
          measure?: string | null
          num_holes?: number
          pars_men?: number[] | null
          pars_women?: number[] | null
          raw?: Json
          timestamp_updated?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "golfapi_courses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "golfapi_clubs"
            referencedColumns: ["club_id"]
          },
        ]
      }
      golfapi_tees: {
        Row: {
          course_id: string
          course_rating_men: number | null
          course_rating_women: number | null
          lengths: number[] | null
          raw: Json
          slope_men: number | null
          slope_women: number | null
          tee_color: string | null
          tee_id: string
          tee_name: string | null
          updated_at: string
        }
        Insert: {
          course_id: string
          course_rating_men?: number | null
          course_rating_women?: number | null
          lengths?: number[] | null
          raw: Json
          slope_men?: number | null
          slope_women?: number | null
          tee_color?: string | null
          tee_id: string
          tee_name?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          course_rating_men?: number | null
          course_rating_women?: number | null
          lengths?: number[] | null
          raw?: Json
          slope_men?: number | null
          slope_women?: number | null
          tee_color?: string | null
          tee_id?: string
          tee_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "golfapi_tees_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "golfapi_courses"
            referencedColumns: ["course_id"]
          },
        ]
      }
      gswing_course_maps: {
        Row: {
          course_name: string
          created_at: string
          external_course_id: string | null
          external_provider: string | null
          id: string
          last_synced: string | null
          latitude: number
          location_label: string | null
          longitude: number
          sync_version: number
          updated_at: string
        }
        Insert: {
          course_name: string
          created_at?: string
          external_course_id?: string | null
          external_provider?: string | null
          id?: string
          last_synced?: string | null
          latitude: number
          location_label?: string | null
          longitude: number
          sync_version?: number
          updated_at?: string
        }
        Update: {
          course_name?: string
          created_at?: string
          external_course_id?: string | null
          external_provider?: string | null
          id?: string
          last_synced?: string | null
          latitude?: number
          location_label?: string | null
          longitude?: number
          sync_version?: number
          updated_at?: string
        }
        Relationships: []
      }
      gswing_hole_features: {
        Row: {
          carry_lat: number | null
          carry_lng: number | null
          center_lat: number | null
          center_lng: number | null
          created_at: string
          feature_type: string
          front_lat: number | null
          front_lng: number | null
          id: string
          mapped_hole_id: string
          name: string | null
          notes: string | null
          polygon_json: Json | null
          side_label: string | null
          updated_at: string
        }
        Insert: {
          carry_lat?: number | null
          carry_lng?: number | null
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string
          feature_type: string
          front_lat?: number | null
          front_lng?: number | null
          id?: string
          mapped_hole_id: string
          name?: string | null
          notes?: string | null
          polygon_json?: Json | null
          side_label?: string | null
          updated_at?: string
        }
        Update: {
          carry_lat?: number | null
          carry_lng?: number | null
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string
          feature_type?: string
          front_lat?: number | null
          front_lng?: number | null
          id?: string
          mapped_hole_id?: string
          name?: string | null
          notes?: string | null
          polygon_json?: Json | null
          side_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gswing_hole_features_mapped_hole_id_fkey"
            columns: ["mapped_hole_id"]
            isOneToOne: false
            referencedRelation: "gswing_mapped_holes"
            referencedColumns: ["id"]
          },
        ]
      }
      gswing_mapped_holes: {
        Row: {
          course_map_id: string
          created_at: string
          green_back_lat: number | null
          green_back_lng: number | null
          green_center_lat: number | null
          green_center_lng: number | null
          green_front_lat: number | null
          green_front_lng: number | null
          hole_number: number
          id: string
          length_meters: number | null
          length_yards: number | null
          par: number | null
          pin_lat: number | null
          pin_lng: number | null
          tee_lat: number | null
          tee_lng: number | null
          updated_at: string
        }
        Insert: {
          course_map_id: string
          created_at?: string
          green_back_lat?: number | null
          green_back_lng?: number | null
          green_center_lat?: number | null
          green_center_lng?: number | null
          green_front_lat?: number | null
          green_front_lng?: number | null
          hole_number: number
          id?: string
          length_meters?: number | null
          length_yards?: number | null
          par?: number | null
          pin_lat?: number | null
          pin_lng?: number | null
          tee_lat?: number | null
          tee_lng?: number | null
          updated_at?: string
        }
        Update: {
          course_map_id?: string
          created_at?: string
          green_back_lat?: number | null
          green_back_lng?: number | null
          green_center_lat?: number | null
          green_center_lng?: number | null
          green_front_lat?: number | null
          green_front_lng?: number | null
          hole_number?: number
          id?: string
          length_meters?: number | null
          length_yards?: number | null
          par?: number | null
          pin_lat?: number | null
          pin_lng?: number | null
          tee_lat?: number | null
          tee_lng?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gswing_mapped_holes_course_map_id_fkey"
            columns: ["course_map_id"]
            isOneToOne: false
            referencedRelation: "gswing_course_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      gswing_membership_audit: {
        Row: {
          actor_user_id: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          payment_session_id: string | null
          plan_code: string | null
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          payment_session_id?: string | null
          plan_code?: string | null
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          payment_session_id?: string | null
          plan_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gswing_membership_audit_payment_session_id_fkey"
            columns: ["payment_session_id"]
            isOneToOne: false
            referencedRelation: "gswing_payment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      gswing_membership_overrides: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          override_type: string
          plan_code: string | null
          reason: string | null
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          override_type: string
          plan_code?: string | null
          reason?: string | null
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          override_type?: string
          plan_code?: string | null
          reason?: string | null
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gswing_membership_overrides_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "gswing_membership_plans"
            referencedColumns: ["plan_code"]
          },
        ]
      }
      gswing_membership_plans: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          feature_keys: string[]
          features: Json
          id: string
          is_internal: boolean
          is_paid: boolean
          plan_code: string
          price_monthly_aed: number | null
          price_yearly_aed: number | null
          tagline: string | null
          tier_rank: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          feature_keys?: string[]
          features?: Json
          id?: string
          is_internal?: boolean
          is_paid?: boolean
          plan_code: string
          price_monthly_aed?: number | null
          price_yearly_aed?: number | null
          tagline?: string | null
          tier_rank?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          feature_keys?: string[]
          features?: Json
          id?: string
          is_internal?: boolean
          is_paid?: boolean
          plan_code?: string
          price_monthly_aed?: number | null
          price_yearly_aed?: number | null
          tagline?: string | null
          tier_rank?: number
          updated_at?: string
        }
        Relationships: []
      }
      gswing_payment_sessions: {
        Row: {
          amount_aed: number
          billing_cycle: string
          checkout_url: string | null
          created_at: string
          expires_at: string
          id: string
          paid_at: string | null
          plan_code: string
          provider: string
          provider_session_id: string | null
          raw_response: Json | null
          status: string
          status_message: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_aed: number
          billing_cycle: string
          checkout_url?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          paid_at?: string | null
          plan_code: string
          provider?: string
          provider_session_id?: string | null
          raw_response?: Json | null
          status?: string
          status_message?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_aed?: number
          billing_cycle?: string
          checkout_url?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          paid_at?: string | null
          plan_code?: string
          provider?: string
          provider_session_id?: string | null
          raw_response?: Json | null
          status?: string
          status_message?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gswing_payment_sessions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "gswing_membership_plans"
            referencedColumns: ["plan_code"]
          },
        ]
      }
      gswing_user_memberships: {
        Row: {
          activated_at: string | null
          billing_cycle: string
          created_at: string
          current_period_end: string | null
          id: string
          last_payment_session_id: string | null
          plan_code: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          billing_cycle?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_payment_session_id?: string | null
          plan_code: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          billing_cycle?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_payment_session_id?: string | null
          plan_code?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gswing_user_memberships_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "gswing_membership_plans"
            referencedColumns: ["plan_code"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      tournament_players: {
        Row: {
          created_at: string
          flight: string | null
          handicap: number
          id: string
          player_name: string
          tee_time: string | null
          tournament_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          flight?: string | null
          handicap?: number
          id?: string
          player_name: string
          tee_time?: string | null
          tournament_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          flight?: string | null
          handicap?: number
          id?: string
          player_name?: string
          tee_time?: string | null
          tournament_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_scores: {
        Row: {
          hole: number
          id: string
          par: number
          player_id: string
          putts: number | null
          strokes: number
          tournament_id: string
          updated_at: string
        }
        Insert: {
          hole: number
          id?: string
          par?: number
          player_id: string
          putts?: number | null
          strokes: number
          tournament_id: string
          updated_at?: string
        }
        Update: {
          hole?: number
          id?: string
          par?: number
          player_id?: string
          putts?: number | null
          strokes?: number
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_scores_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          code: string
          course: string
          course_latitude: number | null
          course_location_label: string | null
          course_longitude: number | null
          created_at: string
          director_id: string | null
          format: string
          gi_course_id: string | null
          holes: number
          id: string
          name: string
          par: number
          scoring: string
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          course: string
          course_latitude?: number | null
          course_location_label?: string | null
          course_longitude?: number | null
          created_at?: string
          director_id?: string | null
          format?: string
          gi_course_id?: string | null
          holes?: number
          id?: string
          name: string
          par?: number
          scoring?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          course?: string
          course_latitude?: number | null
          course_location_label?: string | null
          course_longitude?: number | null
          created_at?: string
          director_id?: string | null
          format?: string
          gi_course_id?: string | null
          holes?: number
          id?: string
          name?: string
          par?: number
          scoring?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
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
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_effective_gswing_membership: {
        Args: { _user_id: string }
        Returns: {
          billing_cycle: string
          current_period_end: string
          is_owner: boolean
          plan_code: string
          source: string
          status: string
          user_id: string
        }[]
      }
      get_hole_geometry: {
        Args: { p_course_id: string; p_hole_number: number }
        Returns: Json
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_gswing_admin: { Args: { _user_id: string }; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "owner" | "platform_owner" | "admin" | "user"
      golf_hazard_type:
        | "bunker"
        | "water"
        | "trees"
        | "waste"
        | "ob"
        | "cart_path"
        | "creek"
        | "other"
      golf_point_type:
        | "tee_back"
        | "tee_middle"
        | "tee_front"
        | "fairway_start"
        | "layup"
        | "green_front"
        | "green_center"
        | "green_back"
        | "pin_position"
        | "dogleg"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
    Enums: {
      app_role: ["owner", "platform_owner", "admin", "user"],
      golf_hazard_type: [
        "bunker",
        "water",
        "trees",
        "waste",
        "ob",
        "cart_path",
        "creek",
        "other",
      ],
      golf_point_type: [
        "tee_back",
        "tee_middle",
        "tee_front",
        "fairway_start",
        "layup",
        "green_front",
        "green_center",
        "green_back",
        "pin_position",
        "dogleg",
      ],
    },
  },
} as const
