export type AppRole = "owner" | "staff";
export type ProfileStatus = "pending" | "approved" | "rejected" | "deactivated";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          display_name: string;
          role: AppRole;
          account_status: ProfileStatus;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          user_id: string;
          display_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      fleet_settings: {
        Row: {
          id: boolean;
          fleet_name: string;
          timezone: string;
          standard_remittance_centavos: number;
          overnight_remittance_centavos: number;
          document_warning_days: number[];
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["fleet_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["fleet_settings"]["Row"]>;
      };
      audit_events: {
        Row: {
          id: number;
          occurred_at: string;
          actor_user_id: string | null;
          entity_type: string;
          entity_id: string;
          action: "insert" | "update" | "soft_delete" | "restore" | "reverse";
          changed_fields: Record<string, unknown>;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_events"]["Row"]>;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      approve_staff_registration: { Args: { p_user_id: string }; Returns: unknown };
      reject_staff_registration: { Args: { p_reason?: string; p_user_id: string }; Returns: unknown };
      set_staff_account_status: { Args: { p_status: ProfileStatus; p_user_id: string }; Returns: unknown };
    };
    Enums: {
      app_role: AppRole;
      profile_status: ProfileStatus;
      audit_action: "insert" | "update" | "soft_delete" | "restore" | "reverse";
    };
    CompositeTypes: Record<string, never>;
  };
}
