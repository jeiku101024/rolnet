import { formatMonth } from "@/lib/sinking-fund/format";

/**
 * Which month labels the monthly chart draws (feature 016). Every month is labeled up to six months, so nothing is
 * missing on a phone; beyond that every other month is labeled, counting back from the latest so the newest month
 * always has its label. Months without a label still have their bars and a tick.
 */
export const maxLabeledMonths = 6;

export function monthLabelPlan(months: readonly string[]): { month: string; label: string | null }[] {
  const every = months.length <= maxLabeledMonths ? 1 : 2;
  return months.map((month, index) => ({ month, label: (months.length - 1 - index) % every === 0 ? formatMonth(month) : null }));
}

/** True when no month has any deposit, loan, or payment (the chart then says so instead of showing an empty frame). */
export function hasNoActivity(flows: readonly { deposits_centavos: number; loans_centavos: number; payments_centavos: number }[]) {
  return flows.every((flow) => flow.deposits_centavos === 0 && flow.loans_centavos === 0 && flow.payments_centavos === 0);
}
