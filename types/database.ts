export type AppRole = "owner" | "staff";
export type ProfileStatus = "pending" | "approved" | "rejected" | "deactivated";

export type DriverKind = "primary" | "backup";
export type DriverAbsenceType = "day_off" | "on_leave";
export type DriverAbsenceReason = "sick" | "vacation" | "family_emergency" | "personal" | "other";
// Feature 013 (migrations 20261102000300/400).
export type DocumentType = "or_cr" | "driver_license" | "mtop_franchise" | "insurance";
export type DocumentLifecycle = "current" | "superseded" | "void" | "reverted";
export type DocumentEventKind = "uploaded" | "renewed" | "reverted" | "removed" | "brought_back" | "restored";

import type { SfDistribution, SfDistributionRow, SfFundSummary, SfInterestSetBy, SfParticipantSummary, SfPrefill, SfRankingRow, SfTransactionType } from "@/lib/sinking-fund/types";

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
      // Feature 015 (migration 20261113000100). Written only through the sf_* functions, so Insert and Update are never.
      sf_participants: {
        Row: { id: string; name: string; name_key: string; driver_id: string | null; notes: string | null; archived_at: string | null; archived_by: string | null; created_at: string; created_by: string | null; updated_at: string; updated_by: string | null; deleted_at: string | null; deleted_by: string | null };
        Insert: never;
        Update: never;
      };
      sf_distributions: {
        Row: { id: string; dist_date: string; available_before_centavos: number; per_participant_centavos: number | null; participant_count: number; total_distributed_centavos: number; remainder_centavos: number; notes: string | null; voided_at: string | null; voided_by: string | null; void_reason: string | null; created_at: string; created_by: string | null; updated_at: string; updated_by: string | null };
        Insert: never;
        Update: never;
      };
      sf_transactions: {
        Row: { id: string; participant_id: string; type: SfTransactionType; amount_centavos: number; tx_date: string; notes: string | null; loan_id: string | null; distribution_id: string | null; interest_rate_bp: number | null; interest_centavos: number | null; amount_due_centavos: number | null; due_date: string | null; interest_part_centavos: number | null; principal_part_centavos: number | null; interest_set_by: SfInterestSetBy | null; interest_waived_centavos: number | null; voided_at: string | null; voided_by: string | null; void_reason: string | null; created_at: string; created_by: string | null; updated_at: string; updated_by: string | null };
        Insert: never;
        Update: never;
      };
      // Feature 016 (migration 20261114000200): one saved row per participant per distribution, owner-read only.
      sf_distribution_participants: {
        Row: { id: string; distribution_id: string; participant_id: string; participant_name: string; savings_before_centavos: number; share_centavos: number; ended_total_centavos: number; created_at: string; created_by: string | null; updated_at: string; updated_by: string | null; deleted_at: string | null; deleted_by: string | null };
        Insert: never;
        Update: never;
      };
      sf_settings: {
        Row: { id: string; default_interest_prefill: SfPrefill; timezone: string; created_at: string; updated_at: string };
        Insert: never;
        Update: never;
      };
    };
    Views: {
      sf_loans_v: {
        Row: { id: string; participant_id: string; loan_date: string; principal_centavos: number; interest_centavos: number; amount_due_centavos: number; due_date: string; interest_paid_centavos: number; principal_paid_centavos: number; unpaid_interest_centavos: number; unpaid_principal_centavos: number; balance_centavos: number; withdrawn_on: string | null; updated_at: string; status: "open" | "paid" | "withdrawn"; overdue: boolean };
      };
      sf_ledger_v: {
        Row: { id: string; participant_id: string; participant_name: string; participant_is_driver: boolean; participant_archived: boolean; type: SfTransactionType; amount_centavos: number; tx_date: string; notes: string | null; loan_id: string | null; distribution_id: string | null; interest_rate_bp: number | null; interest_centavos: number | null; amount_due_centavos: number | null; due_date: string | null; interest_part_centavos: number | null; principal_part_centavos: number | null; interest_set_by: SfInterestSetBy | null; interest_waived_centavos: number | null; voided_at: string | null; void_reason: string | null; created_at: string; updated_at: string; loan_date: string | null; loan_status: "open" | "overdue" | "paid" | "withdrawn" | null; loan_balance_centavos: number | null; loan_interest_paid_centavos: number | null; loan_paid_centavos: number | null; loan_withdrawn_on: string | null; loan_balance_after_centavos: number | null; savings_after_centavos: number | null; distribution_date: string | null; distribution_total_centavos: number | null; distribution_participant_count: number | null };
      };
    };
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

      // Feature 015 (migrations 20261113000200 and 20261113000300).
      sf_add_participant: { Args: { p_name: string; p_driver_id: string | null; p_notes: string | null }; Returns: string };
      sf_rename_participant: { Args: { p_id: string; p_name: string; p_expected_updated_at: string }; Returns: string };
      sf_archive_participant: { Args: { p_id: string; p_expected_updated_at: string }; Returns: string };
      sf_record_deposit: { Args: { p_participant: string; p_date: string; p_amount: number; p_notes: string | null; p_key: string | null }; Returns: string };
      sf_record_loan: { Args: { p_participant: string; p_date: string; p_amount: number; p_notes: string | null; p_key: string | null }; Returns: string };
      sf_record_payment: { Args: { p_loan: string; p_date: string; p_amount: number; p_interest_part: number | null; p_notes: string | null; p_key: string | null }; Returns: string };
      sf_record_savings_withdrawal: { Args: { p_participant: string; p_date: string; p_amount: number; p_notes: string | null; p_key: string | null }; Returns: string };
      sf_mark_loan_withdrawal: { Args: { p_loan: string; p_expected_balance_centavos: number }; Returns: string };
      sf_change_interest_part: { Args: { p_payment: string; p_interest_part: number; p_expected_updated_at: string }; Returns: string };
      sf_distribute_interest: { Args: { p_date: string; p_participants: string[]; p_notes: string | null; p_key: string | null; p_expected_total?: number | null }; Returns: string };
      sf_void_transaction: { Args: { p_id: string; p_reason: string; p_expected_updated_at: string }; Returns: string };
      sf_void_distribution: { Args: { p_id: string; p_reason: string; p_expected_updated_at: string }; Returns: string };
      sf_set_default_prefill: { Args: { p_value: SfPrefill }; Returns: undefined };
      sf_allowed_interest_range: { Args: { p_loan: string; p_amount: number; p_exclude_payment: string | null }; Returns: { min_part: number; max_part: number }[] };
      sf_savings_at: { Args: { p_participant: string; p_as_of?: string | null }; Returns: number };
      sf_fund_summary: { Args: { p_from?: string | null; p_to?: string | null }; Returns: SfFundSummary[] };
      sf_participant_summaries: { Args: { p_as_of?: string | null }; Returns: SfParticipantSummary[] };
      sf_ranking: { Args: { p_rank_by: "savings" | "deposits"; p_start?: string | null; p_end?: string | null }; Returns: SfRankingRow[] };
      sf_monthly_flows: { Args: { p_months?: number }; Returns: { month: string; deposits_centavos: number; loans_centavos: number; payments_centavos: number }[] };
      sf_distribution_history: { Args: Record<string, never>; Returns: (SfDistribution & { void_reason: string | null })[] };
      sf_distribution_details: { Args: { p_id: string }; Returns: SfDistributionRow[] };
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
      // Feature 015.
      sf_transaction_type: SfTransactionType;
      sf_interest_set_by: SfInterestSetBy;
      sf_prefill: SfPrefill;
      expense_category: "change_oil" | "front_tire" | "rear_tire" | "engine_sprocket" | "chain" | "rear_sprocket" | "battery" | "others";
    };
    CompositeTypes: Record<string, never>;
  };
}
