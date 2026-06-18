export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          report_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          report_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          report_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "indicator_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_reports: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string
          denominator: number | null
          id: string
          indicator_id: string
          institution_id: string
          is_zero_report: boolean | null
          numerator: number | null
          period_id: string
          reported_value: number | null
          reporting_month: string | null
          reviewed_at: string | null
          returned_at: string | null
          status: string
          updated_at: string
          verification_method: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by: string
          denominator?: number | null
          id?: string
          indicator_id: string
          institution_id: string
          is_zero_report?: boolean | null
          numerator?: number | null
          period_id: string
          reported_value?: number | null
          reporting_month?: string | null
          reviewed_at?: string | null
          returned_at?: string | null
          status?: string
          updated_at?: string
          verification_method?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string
          denominator?: number | null
          id?: string
          indicator_id?: string
          institution_id?: string
          is_zero_report?: boolean | null
          numerator?: number | null
          period_id?: string
          reported_value?: number | null
          reporting_month?: string | null
          reviewed_at?: string | null
          returned_at?: string | null
          status?: string
          updated_at?: string
          verification_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_reports_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_reports_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_reports_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      indicators: {
        Row: {
          calculation_formula: string | null
          created_at: string
          description: string | null
          id: string
          indicator_type: string
          name: string
          notes: string | null
          q1_prog: number | null
          q2_prog: number | null
          q3_prog: number | null
          q4_prog: number | null
          reporting_frequency: string
          target_value: number
          unit: string
        }
        Insert: {
          calculation_formula?: string | null
          created_at?: string
          description?: string | null
          id?: string
          indicator_type: string
          name: string
          notes?: string | null
          q1_prog?: number | null
          q2_prog?: number | null
          q3_prog?: number | null
          q4_prog?: number | null
          reporting_frequency: string
          target_value: number
          unit: string
        }
        Update: {
          calculation_formula?: string | null
          created_at?: string
          description?: string | null
          id?: string
          indicator_type?: string
          name?: string
          notes?: string | null
          q1_prog?: number | null
          q2_prog?: number | null
          q3_prog?: number | null
          q4_prog?: number | null
          reporting_frequency?: string
          target_value?: number
          unit?: string
        }
        Relationships: []
      }
      institutions: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      instrument_indicators: {
        Row: {
          auto_start: boolean | null
          created_at: string
          id: string
          indicator_id: string
          informant_id: string
          instrument_id: string
          is_active: boolean | null
          last_started_at: string | null
          periodicity: string
          reviewer_id: string
          unit_area: string | null
        }
        Insert: {
          auto_start?: boolean | null
          created_at?: string
          id?: string
          indicator_id: string
          informant_id: string
          instrument_id: string
          is_active?: boolean | null
          last_started_at?: string | null
          periodicity: string
          reviewer_id: string
          unit_area?: string | null
        }
        Update: {
          auto_start?: boolean | null
          created_at?: string
          id?: string
          indicator_id?: string
          informant_id?: string
          instrument_id?: string
          is_active?: boolean | null
          last_started_at?: string | null
          periodicity?: string
          reviewer_id?: string
          unit_area?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instrument_indicators_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrument_indicators_informant_id_fkey"
            columns: ["informant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrument_indicators_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrument_indicators_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          institution_id: string
          is_active: boolean | null
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          institution_id: string
          is_active?: boolean | null
          name: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean | null
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "instruments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      observation_responses: {
        Row: {
          comment: string
          created_at: string
          id: string
          observation_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          observation_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          observation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observation_responses_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          comment: string
          created_at: string
          id: string
          report_id: string
          reviewer_id: string
          status: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          report_id: string
          reviewer_id: string
          status: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          report_id?: string
          reviewer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "observations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "indicator_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          status: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          email: string | null
          id: string
          institution_id: string | null
          name: string
        }
        Insert: {
          email?: string | null
          id: string
          institution_id?: string | null
          name: string
        }
        Update: {
          email?: string | null
          id?: string
          institution_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notification_settings: {
        Row: {
          custom_cc: string[] | null
          description: string | null
          display_name: string
          event_type: string
          id: string
          is_enabled: boolean | null
          notify_roles: string[] | null
          subject_template: string
          body_template: string
          updated_at: string
        }
        Insert: {
          custom_cc?: string[] | null
          description?: string | null
          display_name: string
          event_type: string
          id?: string
          is_enabled?: boolean | null
          notify_roles?: string[] | null
          subject_template: string
          body_template: string
          updated_at?: string
        }
        Update: {
          custom_cc?: string[] | null
          description?: string | null
          display_name?: string
          event_type?: string
          id?: string
          is_enabled?: boolean | null
          notify_roles?: string[] | null
          subject_template?: string
          body_template?: string
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          user_id: string
          required_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "reviewer" | "informant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
