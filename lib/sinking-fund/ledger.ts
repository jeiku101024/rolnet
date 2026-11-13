import { isLive } from "@/lib/sinking-fund/rules";
import type { SfDistribution, SfTransaction } from "@/lib/sinking-fund/types";

/** Effect of one ledger row on the participant's Total savings (data-model.md "Derived values"). */
export function savingsDelta(row: SfTransaction) {
  switch (row.type) {
    case "deposit": return row.amount_centavos;
    case "interest_share": return row.amount_centavos;
    case "payment": return row.principal_part_centavos ?? 0;
    case "loan": return -row.amount_centavos;
    case "savings_withdrawal": return -row.amount_centavos;
    case "loan_withdrawal": return 0; // the principal already left savings when the loan was taken
  }
}

/** Interest fund effect of one row: payments add their interest part (distributions are subtracted separately). */
export function interestDelta(row: SfTransaction) {
  return row.type === "payment" ? row.interest_part_centavos ?? 0 : 0;
}

type Entry = { date: string; delta: number; created: string; id: string };

/** Same-day order used by SQL and here: credits before debits, then creation order, so entry order within a day never matters. */
function ordered(entries: Entry[]) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date) || Number(a.delta < 0) - Number(b.delta < 0) || a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
}

export type NegativeDate = { date: string; availableCentavos: number; rowId: string };

function firstNegative(entries: Entry[]): NegativeDate | null {
  let running = 0;
  for (const entry of ordered(entries)) {
    const before = running;
    running += entry.delta;
    if (running < 0) return { date: entry.date, availableCentavos: before, rowId: entry.id };
  }
  return null;
}

/** First date at which this participant's savings would be negative, or null. Pass the participant's rows only. */
export function findNegativeSavings(rows: readonly SfTransaction[]): NegativeDate | null {
  return firstNegative(rows.filter(isLive).map((row) => ({ date: row.tx_date, delta: savingsDelta(row), created: row.created_at, id: row.id })).filter((entry) => entry.delta !== 0));
}

/** First date at which the Interest fund would be negative, or null. Pass every payment and every distribution. */
export function findNegativeFund(rows: readonly SfTransaction[], distributions: readonly Pick<SfDistribution, "id" | "dist_date" | "total_distributed_centavos" | "voided_at">[]): NegativeDate | null {
  const credits = rows.filter((row) => isLive(row) && row.type === "payment").map((row) => ({ date: row.tx_date, delta: row.interest_part_centavos ?? 0, created: row.created_at, id: row.id }));
  const debits = distributions.filter((distribution) => !distribution.voided_at).map((distribution) => ({ date: distribution.dist_date, delta: -distribution.total_distributed_centavos, created: distribution.dist_date, id: distribution.id }));
  return firstNegative([...credits, ...debits].filter((entry) => entry.delta !== 0));
}

/** Total savings at the end of `asOf` (or now when omitted) from one participant's rows. */
export function savingsAt(rows: readonly SfTransaction[], asOf?: string) {
  return rows.filter((row) => isLive(row) && (!asOf || row.tx_date <= asOf)).reduce((sum, row) => sum + savingsDelta(row), 0);
}

/** Interest fund at the end of `asOf`: collected interest parts minus distribution totals. */
export function fundAt(rows: readonly SfTransaction[], distributions: readonly Pick<SfDistribution, "dist_date" | "total_distributed_centavos" | "voided_at">[], asOf?: string) {
  const collected = rows.filter((row) => isLive(row) && (!asOf || row.tx_date <= asOf)).reduce((sum, row) => sum + interestDelta(row), 0);
  const distributed = distributions.filter((distribution) => !distribution.voided_at && (!asOf || distribution.dist_date <= asOf)).reduce((sum, distribution) => sum + distribution.total_distributed_centavos, 0);
  return collected - distributed;
}

/** Plain-language message for a blocked entry, e.g. "Ana only had ₱1,000.00 on Nov 5, 2026." */
export function negativeSavingsMessage(name: string, found: NegativeDate, formatPesos: (centavos: number) => string) {
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }).format(new Date(`${found.date}T00:00:00Z`));
  return `${name} only had ${formatPesos(found.availableCentavos)} on ${date}.`;
}
