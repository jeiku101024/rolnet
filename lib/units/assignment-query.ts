import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { demoDrivers, demoRemittances, demoUnitAssignmentsDaily, demoUnitStatusChanges, demoUnits } from "@/lib/demo/mode";
import type { AssignmentRows, DriverKind } from "@/lib/units/assignment-board";
import type { StatusChange } from "@/lib/units/status-on";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Embed<T> = T | T[] | null;

/**
 * One date's rows for the Daily assignment view (feature 010): non-archived units with their status
 * history, the date's saved assignments, which units already have a remittance that day, eligible
 * drivers, and (future dates) each unit's latest earlier assignment for pre-fill. `null` reads demo data.
 */
export async function loadAssignmentRows(supabase: Supabase | null, date: string, today: string): Promise<AssignmentRows> {
  if (!supabase) return demoAssignmentRows(date, today);
  const [units, changes, assignments, remittances, drivers, prefill] = await Promise.all([
    supabase.from("units").select("id, name, body_number, plate_number, make_model, created_at").eq("archived", false).is("deleted_at", null),
    supabase.from("unit_status_changes").select("unit_id, from_status, to_status, effective_on, changed_at").is("deleted_at", null),
    supabase.from("unit_assignments").select("id, unit_id, driver_id, notes, updated_at, drivers(full_name, driver_kind)").eq("service_date", date).is("deleted_at", null),
    supabase.from("remittances").select("unit_id").eq("service_date", date).is("deleted_at", null),
    supabase.from("drivers").select("id, full_name, driver_kind, is_active, license_expiry_date").is("deleted_at", null).eq("is_active", true).gte("license_expiry_date", date),
    date > today ? supabase.rpc("latest_unit_assignments_before", { p_date: date }) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [units, changes, assignments, remittances, drivers, prefill]) if (result.error) throw result.error;
  return {
    units: units.data ?? [],
    statusChanges: (changes.data ?? []) as AssignmentRows["statusChanges"],
    // An assignment whose driver was archived comes back without a name (drivers RLS hides deleted rows).
    assignments: (assignments.data ?? []).map(({ drivers: driver, ...row }) => {
      const embedded = one(driver as Embed<{ full_name: string; driver_kind: DriverKind }>);
      return { ...row, driverName: embedded?.full_name ?? "Archived driver", driverKind: embedded?.driver_kind ?? "primary" };
    }),
    remittanceUnitIds: (remittances.data ?? []).map((row) => row.unit_id as string),
    drivers: (drivers.data ?? []) as AssignmentRows["drivers"],
    prefill: ((prefill.data ?? []) as { unit_id: string; driver_id: string }[]).map(({ unit_id, driver_id }) => ({ unit_id, driver_id })),
  };
}

/** Demo mode: the same shapes from lib/demo/mode.ts. */
function demoAssignmentRows(date: string, today: string): AssignmentRows {
  const saved = demoUnitAssignmentsDaily.filter((row) => row.service_date === date);
  const latest = new Map<string, { unit_id: string; driver_id: string; service_date: string }>();
  if (date > today) for (const row of demoUnitAssignmentsDaily) if (row.service_date < date && (latest.get(row.unit_id)?.service_date ?? "") < row.service_date) latest.set(row.unit_id, row);
  return {
    units: demoUnits.filter((unit) => !unit.archived).map(({ id, name, body_number, plate_number, make_model, created_at }) => ({ id, name, body_number, plate_number, make_model, created_at })),
    statusChanges: demoUnitStatusChanges.map((change) => ({ ...change })) as (StatusChange & { unit_id: string })[],
    assignments: saved.map(({ id, unit_id, driver_id, notes, updated_at, driverName, driverKind }) => ({ id, unit_id, driver_id, notes, updated_at, driverName, driverKind })),
    remittanceUnitIds: demoRemittances.filter((row) => row.service_date === date).map((row) => demoUnits[demoRemittances.indexOf(row) % 3].id),
    drivers: demoDrivers.filter((driver) => driver.is_active && driver.license_expiry_date >= date).map(({ id, full_name, driver_kind, is_active, license_expiry_date }) => ({ id, full_name, driver_kind: driver_kind as DriverKind, is_active, license_expiry_date })),
    prefill: [...latest.values()].map(({ unit_id, driver_id }) => ({ unit_id, driver_id })),
  };
}
