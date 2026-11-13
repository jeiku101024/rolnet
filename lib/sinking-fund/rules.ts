import type { SfLoan, SfPrefill, SfTransaction } from "@/lib/sinking-fund/types";

/** System constants (spec section 10): shown read-only in Fund settings and mirrored by `sf_constants()` in SQL. */
export const SF_INTEREST_RATE_BP = 500; // 5%, stored on each loan so a later change never alters old loans
export const SF_LOAN_STEP_CENTAVOS = 10_000; // ₱100
export const SF_LOAN_TERM_MONTHS = 1;

/** True for a positive multiple of ₱100 (so the interest is always a whole-peso amount). */
export function isLoanStep(amountCentavos: number) {
  return Number.isInteger(amountCentavos) && amountCentavos > 0 && amountCentavos % SF_LOAN_STEP_CENTAVOS === 0;
}

/** Principal × 5%. ₱2,000 (200,000 centavos) gives ₱100 (10,000 centavos). */
export function loanInterest(principalCentavos: number) {
  return (principalCentavos * SF_INTEREST_RATE_BP) / 10_000;
}

export function loanAmountDue(principalCentavos: number) {
  return principalCentavos + loanInterest(principalCentavos);
}

/** Loan date plus one calendar month; if that day does not exist, the last day of that month (Jan 31 gives Feb 28). */
export function loanDueDate(loanDate: string) {
  const [year, month, day] = loanDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + SF_LOAN_TERM_MONTHS, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export type InterestRange = { min: number; max: number };

/**
 * Allowed interest part for one payment, from the loan's OTHER non-voided payments (spec section 4):
 * at most the smaller of the payment and the unpaid interest; at least the payment minus the unpaid principal (never below 0).
 * `max` is never below `min` when the payment does not exceed the balance.
 */
export function allowedInterestRange(amountCentavos: number, unpaidInterestCentavos: number, unpaidPrincipalCentavos: number): InterestRange {
  return { min: Math.max(0, amountCentavos - unpaidPrincipalCentavos), max: Math.min(amountCentavos, unpaidInterestCentavos) };
}

/** The Fund settings default: "first" prefills the largest allowed part, "last" the smallest. */
export function defaultInterestPart(prefill: SfPrefill, range: InterestRange) {
  return prefill === "first" ? range.max : range.min;
}

export function splitPayment(amountCentavos: number, interestPartCentavos: number) {
  return { interest: interestPartCentavos, principal: amountCentavos - interestPartCentavos };
}

/** Equal share of the Interest fund, rounded down to the centavo; the remainder stays in the fund. */
export function shareOf(availableCentavos: number, participants: number) {
  if (participants <= 0 || availableCentavos <= 0) return { share: 0, total: 0, remainder: Math.max(availableCentavos, 0) };
  const share = Math.floor(availableCentavos / participants);
  const total = share * participants;
  return { share, total, remainder: availableCentavos - total };
}

/** True when a non-voided row counts (voided rows are ignored by every derived value). */
export function isLive(transaction: Pick<SfTransaction, "voided_at">) {
  return !transaction.voided_at;
}

/** Derives a loan's state from its own row and the ledger, as `sf_loans_v` does. `today` is a YYYY-MM-DD business date. */
export function loanState(loan: SfTransaction, ledger: readonly SfTransaction[], today: string): SfLoan {
  const payments = ledger.filter((row) => isLive(row) && row.type === "payment" && row.loan_id === loan.id);
  const withdrawal = ledger.find((row) => isLive(row) && row.type === "loan_withdrawal" && row.loan_id === loan.id);
  const interestPaid = payments.reduce((sum, row) => sum + (row.interest_part_centavos ?? 0), 0);
  const principalPaid = payments.reduce((sum, row) => sum + (row.principal_part_centavos ?? 0), 0);
  const interest = loan.interest_centavos ?? 0;
  const dueAmount = loan.amount_due_centavos ?? loan.amount_centavos + interest;
  const unpaidInterest = interest - interestPaid;
  const unpaidPrincipal = loan.amount_centavos - principalPaid;
  const withdrawn = Boolean(withdrawal);
  const balance = withdrawn ? 0 : dueAmount - interestPaid - principalPaid;
  const status = withdrawn ? "withdrawn" : balance === 0 ? "paid" : "open";
  const dueDate = loan.due_date ?? loanDueDate(loan.tx_date);
  return {
    id: loan.id,
    participant_id: loan.participant_id,
    loan_date: loan.tx_date,
    principal_centavos: loan.amount_centavos,
    interest_centavos: interest,
    amount_due_centavos: dueAmount,
    due_date: dueDate,
    interest_paid_centavos: interestPaid,
    principal_paid_centavos: principalPaid,
    unpaid_interest_centavos: unpaidInterest,
    unpaid_principal_centavos: unpaidPrincipal,
    balance_centavos: balance,
    status,
    overdue: status === "open" && dueDate < today,
    withdrawn_on: withdrawal?.tx_date ?? null,
    updated_at: loan.updated_at,
  };
}
