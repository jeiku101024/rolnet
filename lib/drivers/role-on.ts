import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { fleetToday } from "@/lib/dates/fleet-date";
import { demoRoleChanges } from "@/lib/demo/mode";
import type { DriverKind } from "@/types/database";

// Feature 012 (research R8): the role a driver had on a date, from the role history log, so switching
// roles never rewrites old records (FR-028, FR-029).

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface RoleChange { id: string; driver_id: string; from_role: DriverKind; to_role: DriverKind; changed_by: string; changed_at: string }

/**
 * The new role of the latest change on or before `date` (fleet day); before the first change, that
 * change's previous role; with no changes, the current role. Withdrawn (undone) changes aren't loaded.
 */
export function roleOn(changes: readonly RoleChange[], currentKind: DriverKind, date: string): DriverKind {
  if (!changes.length) return currentKind;
  const sorted = [...changes].sort((a, b) => a.changed_at.localeCompare(b.changed_at));
  let role: DriverKind = sorted[0].from_role;
  for (const change of sorted) {
    if (fleetToday(new Date(change.changed_at)) > date) break;
    role = change.to_role;
  }
  return role;
}

/** Role changes grouped by driver, newest last. `null` reads demo data. */
export async function loadRoleChanges(supabase: Supabase | null, driverIds: readonly string[]): Promise<Map<string, RoleChange[]>> {
  const ids = [...new Set(driverIds)];
  const rows: RoleChange[] = !ids.length ? [] : supabase
    ? await supabase.from("driver_role_changes").select("id, driver_id, from_role, to_role, changed_by, changed_at").in("driver_id", ids).is("deleted_at", null).order("changed_at")
      .then(({ data, error }) => { if (error) throw error; return (data ?? []) as RoleChange[]; })
    : demoRoleChanges.filter((change) => ids.includes(change.driver_id));
  const byDriver = new Map<string, RoleChange[]>();
  for (const row of rows) byDriver.set(row.driver_id, [...(byDriver.get(row.driver_id) ?? []), row]);
  return byDriver;
}

/** A role-on lookup for many drivers: `role(driverId, currentKind, date)`. */
export function roleLookup(byDriver: Map<string, RoleChange[]>) {
  return (driverId: string, currentKind: DriverKind, date: string) => roleOn(byDriver.get(driverId) ?? [], currentKind, date);
}
