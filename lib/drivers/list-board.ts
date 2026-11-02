import { formatShortDate } from "@/lib/dates/fleet-date";
import { coveringAbsence, daysOpen, isOpenEnded, nextAbsenceLine, staleLevel, statusToday, upcomingAbsences, type Absence, type StaleSettings, type StatusToday } from "@/lib/drivers/absences";
import type { DriverKind } from "@/types/database";

// Feature 012 (US3, US6): Drivers list rows. Pure, so every rule is unit tested: Current unit
// (FR-005), Status today with its second line (FR-006, FR-052), the next absence (FR-007), the
// availability count (FR-008), and the stale-leave banner (FR-053).

export interface ListDriver { id: string; full_name: string; driver_kind: DriverKind; phone: string; license_number: string; license_expiry_date: string; is_active: boolean }
export interface TodayAssignment { driver_id: string; unit_id: string; unitName: string }

export type StatusLine =
  | { kind: "until" | "open" | "checked"; text: string }
  | { kind: "stale"; level: "amber" | "red"; days: number; text: string };

export interface DriverListRow extends ListDriver {
  [key: string]: unknown;
  statusToday: StatusToday;
  /** Today's unit; null with `unitLabel` "Unassigned" (Active, no unit) or "—" (absent or Inactive). */
  currentUnit: { id: string; name: string } | null;
  unitLabel: string;
  statusLine: StatusLine | null;
  nextLine: string | null;
  /** The stale level of the leave covering today, when flagged and not snoozed. */
  stale: "amber" | "red" | null;
  availableToday: boolean;
}

export function buildDriverRows({ drivers, absences, todayAssignments, settings, today }: {
  drivers: readonly ListDriver[];
  absences: readonly Absence[];
  todayAssignments: readonly TodayAssignment[];
  settings: StaleSettings;
  today: string;
}): DriverListRow[] {
  const byDriver = new Map<string, Absence[]>();
  for (const absence of absences) byDriver.set(absence.driver_id, [...(byDriver.get(absence.driver_id) ?? []), absence]);
  const assignedTo = new Map(todayAssignments.map((row) => [row.driver_id, row]));
  return drivers.map((driver) => {
    const own = byDriver.get(driver.id) ?? [];
    const status = statusToday(driver.is_active, own, today);
    const assignment = assignedTo.get(driver.id);
    const covering = coveringAbsence(own, today);
    let statusLine: StatusLine | null = null;
    let stale: DriverListRow["stale"] = null;
    if (status === "on_leave" && covering) {
      const level = staleLevel(covering, today, settings);
      if (level === "amber" || level === "red") {
        const days = daysOpen(covering, today);
        stale = level;
        statusLine = { kind: "stale", level, days, text: `Open for ${days} days` };
      } else if (isOpenEnded(covering)) statusLine = level === "snoozed" ? { kind: "checked", text: "open-ended · checked" } : { kind: "open", text: "open-ended" };
      else if (covering.end_date) statusLine = { kind: "until", text: `until ${formatShortDate(covering.end_date)}` };
    }
    const next = status === "inactive" ? undefined : upcomingAbsences(own, today)[0];
    const absentOrInactive = status !== "active";
    return {
      ...driver,
      statusToday: status,
      currentUnit: !absentOrInactive && assignment ? { id: assignment.unit_id, name: assignment.unitName } : null,
      unitLabel: absentOrInactive ? "—" : assignment ? assignment.unitName : "Unassigned",
      statusLine,
      nextLine: next ? nextAbsenceLine(next) : null,
      stale,
      availableToday: status === "active" && driver.license_expiry_date >= today && !assignment,
    };
  });
}

/** The `stale=1` filter and the banner: drivers whose open-ended leave is flagged and not snoozed. */
export function staleRows<R extends Pick<DriverListRow, "stale">>(rows: readonly R[]) {
  return rows.filter((row) => row.stale !== null);
}

/** Banner copy and tone (FR-053), or null when nothing is flagged. */
export function staleBanner(rows: readonly Pick<DriverListRow, "stale">[], settings: StaleSettings) {
  const flagged = staleRows(rows);
  if (!flagged.length) return null;
  const count = flagged.length;
  return {
    count,
    tone: flagged.some((row) => row.stale === "red") ? "danger" as const : "warning" as const,
    text: `${count} ${count === 1 ? "driver has" : "drivers have"} been on open-ended leave for ${settings.amber} days or more.`,
  };
}
