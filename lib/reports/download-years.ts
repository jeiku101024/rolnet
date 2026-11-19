import { fleetToday } from "@/lib/dates/fleet-date";
import { monthLabels } from "@/lib/reports/periods";

// Feature 019: the Month and Year choices the download overlays share. Years run from the earliest recorded year
// (never more than ten years back) to the current year, the rule the old Reports page used.

const maxYearsBack = 10;

/** Years offered: from the earliest recorded year (or ten years back) to this year, newest first. */
export function yearChoices(earliest: string | null, today = fleetToday()): number[] {
  const thisYear = Number(today.slice(0, 4));
  const first = earliest ? Math.max(Number(earliest.slice(0, 4)), thisYear - maxYearsBack) : thisYear - maxYearsBack;
  return Array.from({ length: thisYear - first + 1 }, (_, index) => thisYear - index);
}

export type MonthChoice = { value: string; label: string };

/** The months of `year` as "01".."12". For the current year the list stops at the current month (no future months). */
export function monthChoices(year: number, today = fleetToday()): MonthChoice[] {
  const thisYear = Number(today.slice(0, 4));
  const last = year === thisYear ? Number(today.slice(5, 7)) : 12;
  return monthLabels.slice(0, last).map((label, index) => ({ value: String(index + 1).padStart(2, "0"), label }));
}

/** The current month as "MM" and the current year, the defaults of the Standings and Expenses overlays. */
export function currentMonthDefaults(today = fleetToday()) {
  return { month: today.slice(5, 7), year: today.slice(0, 4) };
}

/** True when `YYYY-MM` is a real month that is not after the current month and not more than ten years back. */
export function isDownloadableMonth(value: string | null, today = fleetToday()): value is string {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  if (value > today.slice(0, 7)) return false;
  return Number(today.slice(0, 4)) - Number(value.slice(0, 4)) <= maxYearsBack;
}
