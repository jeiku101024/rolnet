import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { demoUnitAssignmentsDaily } from "@/lib/demo/mode";
import type { DriverKind } from "@/lib/units/assignment-board";

// Feature 010 (FR-005, FR-039, FR-050): who drives each unit on a date is the unit's saved daily
// assignment for that date. Replaces the feature 007 primary/backup/day-off coverage rules.

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Embed<T> = T | T[] | null;

export interface TodayDriver { driverId: string; driverName: string; role: DriverKind }

type AssignmentWithDriver = { unit_id: string; driver_id: string; drivers: Embed<{ full_name: string; driver_kind: DriverKind }> };

/** Maps each unit to its saved driver; a driver hidden by RLS (archived) reads as no driver. */
export function driversByUnit(rows: AssignmentWithDriver[]) {
  const result = new Map<string, TodayDriver>();
  for (const row of rows) {
    const driver = one(row.drivers);
    if (driver) result.set(row.unit_id, { driverId: row.driver_id, driverName: driver.full_name, role: driver.driver_kind });
  }
  return result;
}

/** The saved driver of each unit on `date`. `null` reads the demo data. */
export async function currentDriversOn(supabase: Supabase | null, unitIds: string[], date: string) {
  if (!unitIds.length) return new Map<string, TodayDriver>();
  if (!supabase) {
    return driversByUnit(demoUnitAssignmentsDaily.filter((row) => row.service_date === date && unitIds.includes(row.unit_id))
      .map((row) => ({ unit_id: row.unit_id, driver_id: row.driver_id, drivers: { full_name: row.driverName, driver_kind: row.driverKind } })));
  }
  const { data, error } = await supabase.from("unit_assignments").select("unit_id, driver_id, drivers(full_name, driver_kind)").in("unit_id", unitIds).eq("service_date", date).is("deleted_at", null);
  if (error) throw error;
  return driversByUnit((data ?? []) as AssignmentWithDriver[]);
}
