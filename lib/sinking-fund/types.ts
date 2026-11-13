/** Shared types for the Sinking fund (feature 015). All money is integer centavos. */

export type SfTransactionType = "deposit" | "loan" | "payment" | "loan_withdrawal" | "savings_withdrawal" | "interest_share";
export type SfInterestSetBy = "owner" | "default";
export type SfPrefill = "first" | "last";
export type SfView = "transactions" | "top" | "participants";
export type SfLoanStatus = "open" | "paid" | "withdrawn";

export const sfTransactionTypes: readonly SfTransactionType[] = ["deposit", "loan", "payment", "loan_withdrawal", "savings_withdrawal", "interest_share"];

export type SfParticipant = {
  id: string;
  name: string;
  driver_id: string | null;
  notes: string | null;
  archived_at: string | null;
  updated_at: string;
};

/** One ledger row as the list and the TypeScript ledger fold see it. */
export type SfTransaction = {
  id: string;
  participant_id: string;
  type: SfTransactionType;
  amount_centavos: number;
  tx_date: string;
  notes: string | null;
  loan_id: string | null;
  distribution_id: string | null;
  interest_rate_bp: number | null;
  interest_centavos: number | null;
  amount_due_centavos: number | null;
  due_date: string | null;
  interest_part_centavos: number | null;
  principal_part_centavos: number | null;
  interest_set_by: SfInterestSetBy | null;
  interest_waived_centavos: number | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type SfDistribution = {
  id: string;
  dist_date: string;
  available_before_centavos: number;
  per_participant_centavos: number;
  participant_count: number;
  total_distributed_centavos: number;
  remainder_centavos: number;
  notes: string | null;
  voided_at: string | null;
  void_reason?: string | null;
  updated_at: string;
};

/** A loan with its derived state (mirrors the `sf_loans_v` view). */
export type SfLoan = {
  id: string;
  participant_id: string;
  loan_date: string;
  principal_centavos: number;
  interest_centavos: number;
  amount_due_centavos: number;
  due_date: string;
  interest_paid_centavos: number;
  principal_paid_centavos: number;
  unpaid_interest_centavos: number;
  unpaid_principal_centavos: number;
  balance_centavos: number;
  status: SfLoanStatus;
  overdue: boolean;
  withdrawn_on: string | null;
  updated_at: string;
};

export type SfParticipantSummary = {
  participant_id: string;
  name: string;
  driver_id: string | null;
  savings_centavos: number;
  loans_centavos: number;
  balance_to_pay_centavos: number;
  has_overdue: boolean;
  last_transaction_date: string | null;
  interest_shares_centavos: number;
  updated_at: string;
};

export type SfFundSummary = {
  total_savings_centavos: number;
  loans_outstanding_centavos: number;
  open_loan_count: number;
  balance_to_collect_centavos: number;
  payments_received_centavos: number;
  interest_collected_centavos: number;
  interest_distributed_centavos: number;
  interest_available_centavos: number;
  interest_expected_centavos: number;
  participant_count: number;
};

export type SfMonthlyFlow = { month: string; deposits_centavos: number; loans_centavos: number; payments_centavos: number };

export type SfRankingRow = { participant_id: string; name: string; driver_id: string | null; amount_centavos: number };

/** One row of the Transactions list (the `sf_ledger_v` view): a ledger row plus what the list shows around it. */
export type SfLedgerRow = SfTransaction & {
  participant_name: string;
  participant_is_driver: boolean;
  participant_archived: boolean;
  loan_date: string | null;
  loan_status: "open" | "overdue" | "paid" | "withdrawn" | null;
  loan_balance_centavos: number | null;
  loan_interest_paid_centavos: number | null;
  loan_paid_centavos: number | null;
  loan_withdrawn_on: string | null;
  loan_balance_after_centavos: number | null;
  savings_after_centavos: number | null;
  distribution_date: string | null;
  distribution_total_centavos: number | null;
  distribution_participant_count: number | null;
};

export const sfTypeLabels: Record<SfTransactionType, string> = {
  deposit: "Deposit",
  loan: "Loan",
  payment: "Payment",
  loan_withdrawal: "Withdrawal",
  savings_withdrawal: "Savings withdrawal",
  interest_share: "Interest share",
};
