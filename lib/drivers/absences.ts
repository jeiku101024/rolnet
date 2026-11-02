import { addDays, formatShortDate } from "@/lib/dates/fleet-date";
import type { DriverAbsenceReason, DriverAbsenceType } from "@/types/database";

// Feature 012: dated absences (data-model.md). Pure functions over plain YYYY-MM-DD strings, so every
// rule is unit tested. covers() is the same rule as the SQL function driver_absent_on (research R3).

export interface Absence {
  id: string;
  driver_id: string;
  absence_type: DriverAbsenceType;
  start_date: string;
  end_date: string | null;
  reason: DriverAbsenceReason;
  note: string | null;
  cancelled_at: string | null;
  ended_early_on: string | null;
  snoozed_until: string | null;
  updated_at: string;
}

export type StatusToday = "active" | "day_off" | "on_leave" | "inactive";
export type AbsenceStatus = "upcoming" | "active" | "completed" | "cancelled" | "ended_early";
export type StaleLevel = "none" | "amber" | "red" | "snoozed";
export interface StaleSettings { amber: number; red: number; snooze: number }

export const defaultStaleSettings: StaleSettings = { amber: 14, red: 30, snooze: 7 };

export const statusTodayLabels: Record<StatusToday, string> = { active: "Active", day_off: "Day-off", on_leave: "On-leave", inactive: "Inactive" };
export const absenceStatusLabels: Record<AbsenceStatus, string> = { upcoming: "Upcoming", active: "Active now", completed: "Completed", cancelled: "Cancelled", ended_early: "Ended early" };
export const absenceTypeLabels: Record<DriverAbsenceType, string> = { day_off: "Day-off", on_leave: "On-leave" };
export const reasonLabels: Record<DriverAbsenceReason, string> = { sick: "Sick", vacation: "Vacation", family_emergency: "Family emergency", personal: "Personal", other: "Other" };
export const reasonOptions = Object.entries(reasonLabels).map(([value, label]) => ({ value: value as DriverAbsenceReason, label }));

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** True when the absence covers `date`: not cancelled, on or after the start, on or before the end, and before the day it was ended early. */
export function covers(absence: Pick<Absence, "start_date" | "end_date" | "cancelled_at" | "ended_early_on">, date: string) {
  return absence.cancelled_at === null
    && date >= absence.start_date
    && (absence.end_date === null || date <= absence.end_date)
    && (absence.ended_early_on === null || date < absence.ended_early_on);
}

/** The last date the absence covers, or null when it is still open-ended. */
export function lastCoveredDate(absence: Pick<Absence, "end_date" | "ended_early_on">) {
  const endedBefore = absence.ended_early_on ? addDays(absence.ended_early_on, -1) : null;
  if (absence.end_date && endedBefore) return endedBefore < absence.end_date ? endedBefore : absence.end_date;
  return absence.end_date ?? endedBefore;
}

/** The absence that covers `date`, if any (absences never overlap, so there is at most one). */
export function coveringAbsence<A extends Absence>(absences: readonly A[], date: string) {
  return absences.find((absence) => covers(absence, date));
}

/** Absences that haven't started yet and weren't cancelled, soonest first. */
export function upcomingAbsences<A extends Absence>(absences: readonly A[], today: string) {
  return absences.filter((absence) => absence.cancelled_at === null && absence.ended_early_on === null && absence.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

/** Inactive wins; otherwise Day-off or On-leave when an absence covers today; otherwise Active (FR-032). */
export function statusToday(isActive: boolean, absences: readonly Absence[], today: string): StatusToday {
  if (!isActive) return "inactive";
  const absence = coveringAbsence(absences, today);
  return absence ? absence.absence_type : "active";
}

export function absenceStatus(absence: Absence, today: string): AbsenceStatus {
  if (absence.cancelled_at) return "cancelled";
  if (absence.ended_early_on) return "ended_early";
  if (absence.start_date > today) return "upcoming";
  if (covers(absence, today)) return "active";
  return "completed";
}

export function isOpenEnded(absence: Pick<Absence, "absence_type" | "end_date">) {
  return absence.absence_type === "on_leave" && absence.end_date === null;
}

export function daysOpen(absence: Pick<Absence, "start_date">, today: string) {
  return daysBetween(absence.start_date, today);
}

/** The stale flag of an open-ended leave covering today (FR-051); `snoozed` while "Still on leave" applies. */
export function staleLevel(absence: Absence, today: string, settings: StaleSettings): StaleLevel {
  if (!isOpenEnded(absence) || !covers(absence, today)) return "none";
  const days = daysOpen(absence, today);
  if (days < settings.amber) return "none";
  if (absence.snoozed_until && absence.snoozed_until > today) return "snoozed";
  return days >= settings.red ? "red" : "amber";
}

/** "Nov 5" / "Nov 5 to Nov 9" / "from Nov 1 (open-ended)". */
export function formatAbsenceDates(absence: Pick<Absence, "absence_type" | "start_date" | "end_date">) {
  if (absence.absence_type === "day_off") return formatShortDate(absence.start_date);
  if (absence.end_date === null) return `from ${formatShortDate(absence.start_date)} (open-ended)`;
  return `${formatShortDate(absence.start_date)} to ${formatShortDate(absence.end_date)}`;
}

/** The list's second line: "Next: Day-off Nov 3" / "Next: On-leave Nov 5–Nov 9" / "Next: On-leave from Nov 5". */
export function nextAbsenceLine(absence: Pick<Absence, "absence_type" | "start_date" | "end_date">) {
  if (absence.absence_type === "day_off") return `Next: Day-off ${formatShortDate(absence.start_date)}`;
  if (absence.end_date === null) return `Next: On-leave from ${formatShortDate(absence.start_date)}`;
  return `Next: On-leave ${formatShortDate(absence.start_date)}–${formatShortDate(absence.end_date)}`;
}

/** True when the absence covers any date from `start` to `end` (null `end` = open-ended). */
export function overlaps(absence: Pick<Absence, "start_date" | "end_date" | "cancelled_at" | "ended_early_on">, start: string, end: string | null) {
  if (absence.cancelled_at) return false;
  const last = lastCoveredDate(absence);
  if (last !== null && last < absence.start_date) return false;
  return (end === null || absence.start_date <= end) && (last === null || last >= start);
}

/** The overlap message (FR-036), the same wording as save_driver_absence. */
export function conflictMessage(name: string, absence: Pick<Absence, "absence_type" | "start_date" | "end_date">) {
  if (absence.absence_type === "day_off") return `${name} is already on day-off ${formatShortDate(absence.start_date)}.`;
  if (absence.end_date === null) return `${name} is already on leave from ${formatShortDate(absence.start_date)} (no end date).`;
  return `${name} is already on leave ${formatShortDate(absence.start_date)} to ${formatShortDate(absence.end_date)}.`;
}

/** The save toast (FR-039). */
export function absenceToast(name: string, absence: Pick<Absence, "absence_type" | "start_date" | "end_date">) {
  if (absence.absence_type === "day_off") return `${name} is on day-off ${formatShortDate(absence.start_date)}`;
  if (absence.end_date === null) return `${name} is on leave from ${formatShortDate(absence.start_date)} (no end date)`;
  return `${name} is on leave ${formatShortDate(absence.start_date)} to ${formatShortDate(absence.end_date)}`;
}
