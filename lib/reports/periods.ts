import { addDays, fleetToday } from "@/lib/dates/fleet-date";

// Feature 009 (research R6): report periods on plain YYYY-MM-DD calendar dates. Weeks run Monday to
// Sunday; Week 1 of a month runs from the 1st to the first Sunday. Only "today" uses the fleet time zone.

export const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export interface DateRange { from: string; to: string }
export interface ReportDay { date: string; dayLabel: string; monthLabel: string; year: number }
export interface MonthWeek extends DateRange { week: number }

const pad = (value: number) => String(value).padStart(2, "0");

/** 0 for Monday … 6 for Sunday. */
function weekday(date: string) {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** True for a real calendar date in YYYY-MM-DD form. */
export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** Monday to Sunday of the week holding the date. */
export function weekRange(date: string): DateRange {
  const from = addDays(date, -weekday(date));
  return { from, to: addDays(from, 6) };
}

/** `month` is YYYY-MM. */
export function monthRange(month: string): DateRange {
  const [year, number] = month.split("-").map(Number);
  return { from: `${month}-01`, to: `${month}-${pad(daysInMonth(year, number))}` };
}

export function yearRange(year: number): DateRange {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** 1 plus the Mondays after the 1st, up to the date. */
export function weekOfMonth(date: string) {
  const day = Number(date.slice(8, 10));
  const firstWeekday = weekday(`${date.slice(0, 8)}01`);
  const firstMonday = firstWeekday === 0 ? 8 : 8 - firstWeekday;
  return day < firstMonday ? 1 : 2 + Math.floor((day - firstMonday) / 7);
}

/** The month's weeks, cut at its first and last day. */
export function monthWeeks(month: string): MonthWeek[] {
  const { from, to } = monthRange(month);
  const weeks: MonthWeek[] = [];
  for (let start = from; start <= to;) {
    const end = weekRange(start).to < to ? weekRange(start).to : to;
    weeks.push({ week: weekOfMonth(start), from: start, to: end });
    start = addDays(end, 1);
  }
  return weeks;
}

export function days({ from, to }: DateRange): ReportDay[] {
  const result: ReportDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    result.push({ date, dayLabel: dayLabels[weekday(date)], monthLabel: monthLabels[Number(date.slice(5, 7)) - 1], year: Number(date.slice(0, 4)) });
  }
  return result;
}

export type ReportKind = "weekly" | "monthly" | "yearly";

/** Default picker values, from today in the fleet time zone (FR-020). */
export function defaultPeriods(now = new Date()) {
  const today = fleetToday(now);
  return { date: today, month: today.slice(0, 7), year: Number(today.slice(0, 4)) };
}

const maxYearsAway = 10;

/**
 * Checks a report's period input and returns its date range, or a message. Periods more than ten
 * years from today are refused (contracts/reports-http.md).
 */
export function validatePeriod(kind: ReportKind, value: string | null, today = fleetToday()): { range: DateRange; key: string } | { error: string } {
  const thisYear = Number(today.slice(0, 4));
  const near = (year: number) => Math.abs(year - thisYear) <= maxYearsAway;
  if (kind === "weekly") {
    if (!value || !isCalendarDate(value) || !near(Number(value.slice(0, 4)))) return { error: "Choose a valid date." };
    const range = weekRange(value);
    return { range, key: range.from };
  }
  if (kind === "monthly") {
    if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || !near(Number(value.slice(0, 4)))) return { error: "Choose a valid month." };
    return { range: monthRange(value), key: value };
  }
  if (!value || !/^\d{4}$/.test(value) || !near(Number(value))) return { error: "Choose a valid year." };
  return { range: yearRange(Number(value)), key: value };
}

// Feature 014 (research R9): the period texts and Excel dates used by the report workbooks. Month names are
// fixed English arrays, not Intl output, so the text is the same in every runtime.

export const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** Excel's date serial for a YYYY-MM-DD calendar date: days since 1899-12-30. */
export function excelSerial(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000 + 25569;
}

/** "October 2026" for "2026-10". */
export function monthTitle(month: string) {
  return `${monthNames[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

const dayOfMonth = (date: string) => Number(date.slice(8, 10));
const monthLabel = (date: string) => monthLabels[Number(date.slice(5, 7)) - 1];

/** A block's range with an en dash and no spaces: "Oct 1–4", "Oct 26–Nov 1", "Nov 1" for one day. */
export function rangeLabel(from: string, to: string) {
  if (from === to) return `${monthLabel(from)} ${dayOfMonth(from)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${monthLabel(from)} ${dayOfMonth(from)}–${dayOfMonth(to)}`;
  return `${monthLabel(from)} ${dayOfMonth(from)}–${monthLabel(to)} ${dayOfMonth(to)}`;
}

/** The week range with spaced en dash and the year: "Oct 19 – 25, 2026", "Oct 26 – Nov 1, 2026", "Dec 28, 2026 – Jan 3, 2027". */
export function rangeText({ from, to }: DateRange) {
  if (from.slice(0, 4) !== to.slice(0, 4)) return `${monthLabel(from)} ${dayOfMonth(from)}, ${from.slice(0, 4)} – ${monthLabel(to)} ${dayOfMonth(to)}, ${to.slice(0, 4)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${monthLabel(from)} ${dayOfMonth(from)} – ${dayOfMonth(to)}, ${from.slice(0, 4)}`;
  return `${monthLabel(from)} ${dayOfMonth(from)} – ${monthLabel(to)} ${dayOfMonth(to)}, ${to.slice(0, 4)}`;
}

/** "Week of Oct 26 – Nov 1, 2026" for the week starting on the Monday. */
export function weekTitle(monday: string) {
  return `Week of ${rangeText({ from: monday, to: addDays(monday, 6) })}`;
}

/** The hint under the weekly date picker: "Oct 26 – Nov 1, 2026" for any date in that week, or "" for a bad date. */
export function weekRangeText(date: string) {
  return isCalendarDate(date) ? rangeText(weekRange(date)) : "";
}
