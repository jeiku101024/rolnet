import { loanAmountDue, loanDueDate, loanInterest } from "@/lib/sinking-fund/rules";
import type { SfTransaction } from "@/lib/sinking-fund/types";

let counter = 0;

/** Test builders for ledger rows. Amounts are centavos; use `peso(100)` for ₱100. */
export const peso = (amount: number) => Math.round(amount * 100);

function base(participant: string, type: SfTransaction["type"], date: string, amount: number): SfTransaction {
  counter += 1;
  return {
    id: `tx-${String(counter).padStart(4, "0")}`,
    participant_id: participant,
    type,
    amount_centavos: amount,
    tx_date: date,
    notes: null,
    loan_id: null,
    distribution_id: null,
    interest_rate_bp: null,
    interest_centavos: null,
    amount_due_centavos: null,
    due_date: null,
    interest_part_centavos: null,
    principal_part_centavos: null,
    interest_set_by: null,
    interest_waived_centavos: null,
    voided_at: null,
    void_reason: null,
    created_at: `2026-01-01T00:00:${String(counter % 60).padStart(2, "0")}.${String(counter).padStart(3, "0")}Z`,
    updated_at: "2026-01-01T00:00:00Z",
  };
}

export const deposit = (participant: string, date: string, amount: number) => base(participant, "deposit", date, amount);

export function loan(participant: string, date: string, amount: number): SfTransaction {
  return { ...base(participant, "loan", date, amount), interest_rate_bp: 500, interest_centavos: loanInterest(amount), amount_due_centavos: loanAmountDue(amount), due_date: loanDueDate(date) };
}

export function payment(participant: string, loanRow: SfTransaction, date: string, amount: number, interestPart: number): SfTransaction {
  return { ...base(participant, "payment", date, amount), loan_id: loanRow.id, interest_part_centavos: interestPart, principal_part_centavos: amount - interestPart, interest_set_by: "owner" };
}

export function loanWithdrawal(participant: string, loanRow: SfTransaction, date: string, closed: number, waived: number): SfTransaction {
  return { ...base(participant, "loan_withdrawal", date, closed), loan_id: loanRow.id, interest_waived_centavos: waived };
}

export const savingsWithdrawal = (participant: string, date: string, amount: number) => base(participant, "savings_withdrawal", date, amount);

export function interestShare(participant: string, date: string, amount: number, distributionId: string): SfTransaction {
  return { ...base(participant, "interest_share", date, amount), distribution_id: distributionId };
}

export const voided = (row: SfTransaction): SfTransaction => ({ ...row, voided_at: "2026-02-01T00:00:00Z", void_reason: "test" });
