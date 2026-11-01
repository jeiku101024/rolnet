import { fleetToday } from "@/lib/dates/fleet-date";
import type { UnitStatus } from "@/lib/status/record-status";

// Feature 010 (FR-024, research R3): the status a unit had on a date, from its status history.
// Mirrors public.unit_status_on() in 20261101000200_unit_status_history_and_archive.sql.

export interface StatusChange {
  from_status: UnitStatus | null;
  to_status: UnitStatus;
  effective_on: string;
  changed_at: string;
}

/**
 * The latest change on or before `date`; before the first change, that change's previous status;
 * with no history, Active. A future date gets the current status, since no change is dated ahead.
 */
export function statusOn(changes: StatusChange[], date: string): UnitStatus {
  const ordered = [...changes].sort((a, b) => a.effective_on.localeCompare(b.effective_on) || a.changed_at.localeCompare(b.changed_at));
  const inEffect = ordered.filter((change) => change.effective_on <= date).at(-1);
  if (inEffect) return inEffect.to_status;
  return ordered[0]?.from_status ?? "active";
}

/** In repair and Retired units are blocked from assignments and remittances on that date (FR-026). */
export function isBlocked(status: UnitStatus) {
  return status === "in_repair" || status === "retired";
}

/** A unit appears in the daily views from the fleet day it was added (FR-011a). */
export function existsOn(createdAt: string, date: string) {
  return fleetToday(new Date(createdAt)) <= date;
}
