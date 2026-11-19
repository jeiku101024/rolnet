import { fleetToday, formatShortDate } from "@/lib/dates/fleet-date";
import { formatPesos } from "@/lib/money/centavos";

// Feature 020 (spec FR-014): a remittance's Deposit counts every payment on its own service-date row, as the List view
// does. A payment that arrived after the service date is also noted in the Notes column of the Weekly and Monthly
// unit sheets, so a bookkeeper can see why that row's Deposit moved later.

/** A payment received after the remittance's service date. `date` is the fleet-time-zone calendar date, YYYY-MM-DD. */
export type LatePayment = { date: string; amountCentavos: number };

/**
 * The payments dated after `serviceDate`, oldest first. A payment's date is its fleet-time-zone day, so one taken at
 * 23:30 Manila time stays on its own day. Payments on or before the service date are not late.
 */
export function latePaymentsFor(serviceDate: string, payments: readonly { paid_at: string; amount_centavos: number }[]): LatePayment[] {
  return payments
    .map((payment) => ({ date: fleetToday(new Date(payment.paid_at)), amountCentavos: Number(payment.amount_centavos) }))
    .filter((payment) => payment.date > serviceDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The Notes text: "Received later: ₱180.00 on Nov 22" for one payment, "Received later: 3 payments, ₱540.00 (last Nov 22)"
 * for several (so it always fits the fixed-height cell), and "" when there is none.
 */
export function lateNote(latePayments: readonly LatePayment[]): string {
  if (!latePayments.length) return "";
  if (latePayments.length === 1) return `Received later: ${formatPesos(latePayments[0].amountCentavos)} on ${formatShortDate(latePayments[0].date)}`;
  const total = latePayments.reduce((sum, payment) => sum + payment.amountCentavos, 0);
  const last = latePayments.reduce((latest, payment) => (payment.date > latest ? payment.date : latest), latePayments[0].date);
  return `Received later: ${latePayments.length} payments, ${formatPesos(total)} (last ${formatShortDate(last)})`;
}
