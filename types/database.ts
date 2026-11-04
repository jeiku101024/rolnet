export type AppRole = "owner" | "staff";
export type ProfileStatus = "pending" | "approved" | "rejected" | "deactivated";

export type DriverKind = "primary" | "backup";
export type DriverAbsenceType = "day_off" | "on_leave";
export type DriverAbsenceReason = "sick" | "vacation" | "family_emergency" | "personal" | "other";
// Feature 013 (migrations 20261102000300/400).
export type DocumentType = "or_cr" | "driver_license" | "mtop_franchise" | "insurance";
export type DocumentLifecycle = "current" | "superseded" | "void" | "reverted";
export type DocumentEventKind = "uploaded" | "renewed" | "reverted" | "removed" | "brought_back" | "restored";

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
          // Feature 012 (migration 20261102000100): stale open-ended leave thresholds, in days.
          stale_leave_amber_days: number;
          stale_leave_red_days: number;
          stale_leave_snooze_days: number;
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
      // Feature 012 (migration 20261102000100): dated driver absences and "Still on leave" checks.
      driver_absences: {
        Row: {
          id: string;
          driver_id: string;
          absence_type: DriverAbsenceType;
          start_date: string;
          end_date: string | null;
          reason: DriverAbsenceReason;
          note: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          ended_early_on: string | null;
          ended_early_at: string | null;
          ended_early_by: string | null;
          snoozed_until: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["driver_absences"]["Row"]> & {
          driver_id: string;
          absence_type: DriverAbsenceType;
          start_date: string;
          reason: DriverAbsenceReason;
        };
        Update: Partial<Database["public"]["Tables"]["driver_absences"]["Row"]>;
      };
      driver_absence_confirmations: {
        Row: {
          id: string;
          absence_id: string;
          confirmed_by: string;
          confirmed_at: string;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["driver_absence_confirmations"]["Row"]> & { absence_id: string; confirmed_by: string };
        Update: Partial<Database["public"]["Tables"]["driver_absence_confirmations"]["Row"]>;
      };
      // Feature 012 (migration 20261102000200): Primary/Backup switches, written by set_driver_role.
      driver_role_changes: {
        Row: {
          id: string;
          driver_id: string;
          from_role: DriverKind;
          to_role: DriverKind;
          changed_by: string;
          changed_at: string;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: never;
        Update: never;
      };
      // Feature 013 (migration 20261102000400): document Activity, written by the document functions.
      document_events: {
        Row: {
          id: string;
          document_type: DocumentType;
          unit_id: string | null;
          driver_id: string | null;
          kind: DocumentEventKind;
          version_id: string;
          related_version_id: string | null;
          file_name: string | null;
          related_file_name: string | null;
          summary: string;
          occurred_at: string;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: never;
        Update: never;
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
      // Feature 014.
      report_unit_month_totals: {
        Args: { p_from: string; p_to: string };
        Returns: { unit_id: string; month: string; rental_centavos: number; allowance_centavos: number; remittance_count: number; expense_centavos: number }[];
      };
      // Feature 012.
      save_driver_absence: {
        Args: { p_id: string | null; p_driver_id: string; p_type: DriverAbsenceType; p_start: string; p_end: string | null; p_reason: DriverAbsenceReason; p_note: string | null; p_release_ids: string[]; p_expected_updated_at?: string | null };
        Returns: Database["public"]["Tables"]["driver_absences"]["Row"];
      };
      cancel_driver_absence: { Args: { p_id: string; p_expected_updated_at: string }; Returns: Database["public"]["Tables"]["driver_absences"]["Row"] };
      end_driver_absence: { Args: { p_id: string; p_expected_updated_at: string; p_cancel_upcoming?: boolean }; Returns: Database["public"]["Tables"]["driver_absences"]["Row"] };
      confirm_driver_leave: { Args: { p_id: string }; Returns: Database["public"]["Tables"]["driver_absences"]["Row"] };
      set_driver_role: { Args: { p_driver_id: string; p_to_role: DriverKind; p_expected_updated_at: string }; Returns: string | null };
      undo_driver_role_change: { Args: { p_change_id: string }; Returns: undefined };
      // Feature 013. documents gains file_name, superseded_at, reverted_at, reverted_by, purge_after, file_deleted_at.
      save_compliance_document: { Args: { p_document: Record<string, unknown> }; Returns: { version_id: string; renewed: boolean; previous_id: string | null } };
      revert_document_upload: { Args: { p_current_id: string }; Returns: { result: "previous" | "removed"; version_id: string; restored_id: string | null } };
      restore_document_version: { Args: { p_version_id: string; p_current_id: string | null }; Returns: { version_id: string; moved_id: string | null } };
      bring_back_document_version: { Args: { p_version_id: string; p_current_id: string | null }; Returns: { result: "swapped" | "recreated"; version_id: string; moved_id: string | null } };
      mark_document_files_deleted: { Args: { p_ids: string[] }; Returns: number };
    };
    Enums: {
      app_role: AppRole;
      profile_status: ProfileStatus;
      audit_action: "insert" | "update" | "soft_delete" | "restore" | "reverse";
      // Feature 011 (migration 20261101000500). Declared order is the display order.
      // Feature 012 (migration 20261102000100).
      driver_kind: DriverKind;
      driver_absence_type: DriverAbsenceType;
      driver_absence_reason: DriverAbsenceReason;
      // Feature 013.
      document_type: DocumentType;
      document_lifecycle: DocumentLifecycle;
      document_event_kind: DocumentEventKind;
      expense_category: "change_oil" | "front_tire" | "rear_tire" | "engine_sprocket" | "chain" | "rear_sprocket" | "battery" | "others";
    };
    CompositeTypes: Record<string, never>;
  };
}
