import { covers, type Absence } from "@/lib/drivers/absences";
import type { DriverKind } from "@/types/database";

// Feature 012 (FR-040, data-model.md "Availability on a date"): who the Assign driver dropdown offers
// on a date, and how many drivers are hidden and why. Hidden reasons use the first match, in order.

export interface AvailabilityDriver { id: string; full_name: string; driver_kind: DriverKind; is_active: boolean; license_expiry_date: string }
export interface HiddenCounts { inactive: number; absent: number; licenceExpired: number; assigned: number }
export interface Availability { available: { id: string; name: string; role: DriverKind }[]; hidden: HiddenCounts }

export type UnavailableReason = keyof HiddenCounts;

const byName = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Why a driver isn't available on `date`, or null when he is. `assignedDriverIds` are drivers saved on a unit that date. */
export function unavailableReason(driver: AvailabilityDriver, absences: readonly Pick<Absence, "driver_id" | "start_date" | "end_date" | "cancelled_at" | "ended_early_on">[], assignedDriverIds: ReadonlySet<string>, date: string): UnavailableReason | null {
  if (!driver.is_active) return "inactive";
  if (absences.some((absence) => absence.driver_id === driver.id && covers(absence, date))) return "absent";
  if (driver.license_expiry_date < date) return "licenceExpired";
  if (assignedDriverIds.has(driver.id)) return "assigned";
  return null;
}

export function availability({ drivers, absences, assignedDriverIds, date }: { drivers: readonly AvailabilityDriver[]; absences: readonly Pick<Absence, "driver_id" | "start_date" | "end_date" | "cancelled_at" | "ended_early_on">[]; assignedDriverIds: Iterable<string>; date: string }): Availability {
  const assigned = new Set(assignedDriverIds);
  const hidden: HiddenCounts = { inactive: 0, absent: 0, licenceExpired: 0, assigned: 0 };
  const available: Availability["available"] = [];
  for (const driver of drivers) {
    const reason = unavailableReason(driver, absences, assigned, date);
    if (reason) hidden[reason] += 1;
    else available.push({ id: driver.id, name: driver.full_name, role: driver.driver_kind });
  }
  available.sort((a, b) => byName.compare(a.name, b.name));
  return { available, hidden };
}
