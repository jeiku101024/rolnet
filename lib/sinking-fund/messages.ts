import { formatPesos } from "@/lib/money/centavos";

/** Toast and error copy for the Sinking fund (spec sections 5–10 and 15). */
export const sfMessages = {
  participantAdded: "Participant added",
  nameUpdated: "Name updated",
  participantArchived: "Participant archived",
  depositRecorded: "Deposit recorded",
  savingsWithdrawalRecorded: "Savings withdrawal recorded",
  loanClosed: "Loan closed as withdrawal. Savings unchanged.",
  interestPartUpdated: "Interest part updated",
  transactionVoided: "Transaction voided",
  distributionVoided: "Distribution voided",
  settingsSaved: "Fund settings saved.",
  ownerOnly: "Only the owner can do this.",
  demoMode: "Demo mode doesn't save changes. Sign in to the live app to change the sinking fund.",
  loanStep: "Loans must be in steps of ₱100 (₱100, ₱200, ₱300...).",
  noOpenLoans: "No open loans",
  interestReadOnlyHint: "The owner can change this later.",
  voidWithdrawalFirst: "Void the Withdrawal first.",
} as const;

export function duplicateNameMessage(name: string) {
  return `A participant named ${name} already exists.`;
}

export function loanTooHighMessage(savingsCentavos: number) {
  return `Loan cannot be higher than total savings (${formatPesos(savingsCentavos)}).`;
}

export function paymentTooHighMessage(balanceCentavos: number) {
  return `Payment cannot be higher than the balance (${formatPesos(balanceCentavos)}).`;
}

export function interestRangeMessage(minCentavos: number, maxCentavos: number) {
  return `Interest part must be between ${formatPesos(minCentavos)} and ${formatPesos(maxCentavos)} for this payment.`;
}

export function savingsWithdrawalTooHighMessage(savingsCentavos: number) {
  return `Withdrawal cannot be higher than total savings (${formatPesos(savingsCentavos)}).`;
}

export function paymentBeforeLoanMessage(loanDate: string) {
  return `Payment date cannot be before the loan date (${loanDate}).`;
}

/** "Dec 3" for a YYYY-MM-DD date, used in toasts. */
export function shortDueDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Toast amounts drop the .00 on whole pesos, as in the spec examples ("To pay ₱2,100"). */
const toastPesos = (centavos: number) => formatPesos(centavos).replace(/\.00$/, "");

export function formatLoanToast(amountDueCentavos: number, dueDate: string) {
  return `Loan recorded. To pay ${toastPesos(amountDueCentavos)} by ${shortDueDate(dueDate)}`;
}

export function formatPaymentToast(balanceAfterCentavos: number) {
  return balanceAfterCentavos === 0 ? "Payment recorded. Loan fully paid" : `Payment recorded. Balance ${toastPesos(balanceAfterCentavos)}`;
}

/** `shareCount` is the number of participants who received a share above ₱0.00. */
export function formatDistributionToast(totalCentavos: number, shareCount: number) {
  return `${toastPesos(totalCentavos)} distributed to ${shareCount} participant${shareCount === 1 ? "" : "s"}. Year closed. Everyone starts again from ₱0.00.`;
}

export const distributeWarning = "Confirming saves each ticked participant's ended total, then resets their savings, loans, balance, and payments to ₱0.00. Earlier transactions stay in history.";
