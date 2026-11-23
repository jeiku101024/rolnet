import type { SfLoan, SfLoanPayment } from "@/lib/sinking-fund/types";

/** Pure rules for the participant page's Loans section (feature 022). Money stays in integer centavos. */

/** Closed loans per page on the Paid and closed tab (smaller than the app's usual 10 to keep the section compact). */
export const closedPageSize = 5;

/** A loan is active while it has a balance and was not closed as a withdrawal (the database calls it `open`). */
export const isActiveLoan = (loan: SfLoan) => loan.status === "open";

export function splitLoans(loans: readonly SfLoan[]) {
  return { active: loans.filter(isActiveLoan), closed: loans.filter((loan) => !isActiveLoan(loan)) };
}

/** Overdue first, then the nearest due date, then the oldest loan. */
export function sortActive(loans: readonly SfLoan[]) {
  return [...loans].sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.due_date.localeCompare(b.due_date) || a.loan_date.localeCompare(b.loan_date) || a.id.localeCompare(b.id));
}

/** Newest loan first. */
export function sortClosed(loans: readonly SfLoan[]) {
  return [...loans].sort((a, b) => b.loan_date.localeCompare(a.loan_date) || b.id.localeCompare(a.id));
}

const DAY_MS = 86_400_000;

/** Whole days from `today` to `dueDate` (both YYYY-MM-DD); negative once the due date has passed. */
export function daysLeft(dueDate: string, today: string) {
  return Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

export type DueText = { text: string; tone: "overdue" | "soon" | "normal" };

export function dueText(days: number): DueText {
  if (days < 0) return { text: `Overdue by ${-days} ${-days === 1 ? "day" : "days"}`, tone: "overdue" };
  if (days === 0) return { text: "Due today", tone: "soon" };
  if (days === 1) return { text: "1 day left", tone: "soon" };
  return { text: `${days} days left`, tone: days <= 7 ? "soon" : "normal" };
}

export function activeSummary(loans: readonly SfLoan[]) {
  return {
    count: loans.length,
    balanceCentavos: loans.reduce((sum, loan) => sum + Math.max(loan.balance_centavos, 0), 0),
    overdue: loans.filter((loan) => loan.overdue).length,
  };
}

/** Share of the amount due already paid, as a whole percent from 0 to 100. */
export function percentPaid(loan: Pick<SfLoan, "amount_due_centavos" | "interest_paid_centavos" | "principal_paid_centavos">) {
  if (loan.amount_due_centavos <= 0) return 0;
  const paid = (loan.interest_paid_centavos + loan.principal_paid_centavos) / loan.amount_due_centavos;
  return Math.min(100, Math.max(0, Math.round(paid * 100)));
}

/** The two progress-bar segments as percentages of the amount due. */
export function barShares(loan: Pick<SfLoan, "amount_due_centavos" | "interest_paid_centavos" | "principal_paid_centavos">) {
  if (loan.amount_due_centavos <= 0) return { interest: 0, principal: 0 };
  const share = (part: number) => Math.min(100, Math.max(0, (part / loan.amount_due_centavos) * 100));
  const interest = share(loan.interest_paid_centavos);
  return { interest, principal: Math.min(share(loan.principal_paid_centavos), 100 - interest) };
}

/** The balance to show: never below zero. */
export const shownBalance = (loan: Pick<SfLoan, "balance_centavos">) => Math.max(loan.balance_centavos, 0);

export function paymentsByLoan(payments: readonly SfLoanPayment[]) {
  const byLoan = new Map<string, SfLoanPayment[]>();
  for (const payment of payments) byLoan.set(payment.loan_id, [...(byLoan.get(payment.loan_id) ?? []), payment]);
  return byLoan;
}

/** Calendar years of the closed loans, newest first. */
export function closedYears(loans: readonly SfLoan[]) {
  return [...new Set(loans.map((loan) => loan.loan_date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
}

export type ClosedView = {
  rows: SfLoan[];
  page: number;
  lastPage: number;
  total: number;
  rangeLabel: string;
  /** What the matching Paid loans repaid; withdrawn loans did not repay in full, so they are left out. */
  repaidCentavos: number;
};

/** One page of the closed loans for a year ("all" for every year); the page is clamped to the pages that exist. */
export function closedView(loans: readonly SfLoan[], year: string, requestedPage: number): ClosedView {
  const matching = sortClosed(loans.filter((loan) => year === "all" || loan.loan_date.startsWith(year)));
  const total = matching.length;
  const lastPage = Math.max(1, Math.ceil(total / closedPageSize));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), lastPage);
  const from = (page - 1) * closedPageSize;
  const rows = matching.slice(from, from + closedPageSize);
  const rangeLabel = total === 0 ? "0 loans" : `${from + 1} to ${from + rows.length} of ${total}`;
  const repaidCentavos = matching.filter((loan) => loan.status === "paid").reduce((sum, loan) => sum + loan.amount_due_centavos, 0);
  return { rows, page, lastPage, total, rangeLabel, repaidCentavos };
}
