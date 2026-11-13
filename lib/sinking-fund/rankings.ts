import { addDays } from "@/lib/dates/fleet-date";
import type { SfRankingRow } from "@/lib/sinking-fund/types";

export type RankedRow = SfRankingRow & { rank: number };

/**
 * Standard competition ranking: equal amounts share a rank (1, 1, 3), highest first, then by name.
 * Participants with 0 are listed last and get no rank (rank 0) so no trophy is shown (spec section 12).
 */
export function rankRows(rows: readonly SfRankingRow[]): RankedRow[] {
  const sorted = [...rows].sort((a, b) => b.amount_centavos - a.amount_centavos || a.name.localeCompare(b.name));
  const ranked: RankedRow[] = [];
  let lastAmount: number | null = null;
  let lastRank = 0;
  sorted.forEach((row, index) => {
    if (row.amount_centavos <= 0) { ranked.push({ ...row, rank: 0 }); return; }
    if (row.amount_centavos !== lastAmount) { lastRank = index + 1; lastAmount = row.amount_centavos; }
    ranked.push({ ...row, rank: lastRank });
  });
  return ranked;
}

/** Trophy colour for ranks 1 to 3, or null. */
export function trophyFor(rank: number): "gold" | "silver" | "bronze" | null {
  return rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : null;
}

export const placeLabel = (rank: number) => (rank === 1 ? "1st place" : rank === 2 ? "2nd place" : rank === 3 ? "3rd place" : `Rank ${rank}`);

export type RankPeriod = "all" | "month" | "week";

/** First and last day of a month given as "YYYY-MM". */
export function monthRange(month: string) {
  const [year, number] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

/** Monday of the week containing a YYYY-MM-DD date. */
export function weekStart(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7));
}

export function shiftMonth(month: string, delta: number) {
  const [year, number] = month.split("-").map(Number);
  const moved = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The period the Top view ranks: start and end dates plus the label, or null dates for "all time". */
export function periodRange(period: RankPeriod, at: string | undefined, today: string) {
  if (period === "month") {
    const month = at && /^\d{4}-\d{2}$/.test(at) && at <= today.slice(0, 7) ? at : today.slice(0, 7);
    const { start, end } = monthRange(month);
    const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${start}T00:00:00Z`));
    // The current period runs to today, not to the month's end.
    return { start, end: end > today ? today : end, label, key: month, previous: shiftMonth(month, -1), next: month < today.slice(0, 7) ? shiftMonth(month, 1) : null };
  }
  if (period === "week") {
    const current = weekStart(today);
    const picked = at && /^\d{4}-\d{2}-\d{2}$/.test(at) ? weekStart(at) : current;
    const start = picked > current ? current : picked;
    const end = addDays(start, 6);
    const fmt = (d: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${d}T00:00:00Z`));
    return { start, end: end > today ? today : end, label: `${fmt(start)} to ${fmt(end)}`, key: start, previous: addDays(start, -7), next: start < current ? addDays(start, 7) : null };
  }
  return { start: null, end: null, label: "All time", key: "", previous: null, next: null };
}
