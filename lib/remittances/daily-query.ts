import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { demoDrivers, demoRemittances, demoUnitAssignmentsDaily, demoUnitStatusChanges, demoUnits } from "@/lib/demo/mode";
import type { DailyRows, Disposition, DriverRole } from "@/lib/remittances/daily-board";
import type { StatusChange } from "@/lib/units/status-on";
import { loadRoleChanges, roleLookup } from "@/lib/drivers/role-on";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Embed<T> = T | T[] | null;
type DriverEmbed = Embed<{ full_name: string; driver_kind: DriverRole }>;

/**
 * One date's rows for Daily view (feature 008, updated by feature 010): units with their status
 * history, the date's saved daily assignments, and the date's remittances with their payments and
 * the driver each was saved under. `null` reads the demo data. Feature 012: each driver's tag is the
 * role he had on the date, from the role history (FR-029).
 */
export async function loadDailyRows(supabase: Supabase | null, date: string): Promise<DailyRows> {
  const rows = supabase ? await loadLiveRows(supabase, date) : demoDailyRows(date);
  const driverIds = [...rows.assignments.map((row) => row.driver_id), ...rows.remittances.map((row) => row.driver_id as string)];
  const role = roleLookup(await loadRoleChanges(supabase, driverIds));
  return {
    ...rows,
    assignments: rows.assignments.map((row) => ({ ...row, driverRole: role(row.driver_id, row.driverRole, date) })),
    remittances: rows.remittances.map((row) => ({ ...row, driverRole: role(row.driver_id as string, row.driverRole, date) })),
  };
}

async function loadLiveRows(supabase: Supabase, date: string): Promise<DailyRows> {
  const [units, changes, assignments, remittances] = await Promise.all([
    supabase.from("units").select("id, name, body_number, created_at, archived").is("deleted_at", null),
    supabase.from("unit_status_changes").select("unit_id, from_status, to_status, effective_on, changed_at").is("deleted_at", null),
    supabase.from("unit_assignments").select("unit_id, driver_id, drivers(full_name, driver_kind)").eq("service_date", date).is("deleted_at", null),
    supabase.from("remittances").select("id, unit_id, driver_id, disposition, amount_due_centavos, allowance_centavos, deposit_centavos, notes, updated_at, drivers(full_name, driver_kind), remittance_payments(amount_centavos, deleted_at)").eq("service_date", date).is("deleted_at", null),
  ]);
  for (const result of [units, changes, assignments, remittances]) if (result.error) throw result.error;

  return {
    units: units.data ?? [],
    statusChanges: (changes.data ?? []) as DailyRows["statusChanges"],
    // An assignment whose driver is archived comes back without a name (drivers RLS hides deleted rows); drop it.
    assignments: (assignments.data ?? []).flatMap((row) => {
      const driver = one(row.drivers as DriverEmbed);
      return driver ? [{ unit_id: row.unit_id as string, driver_id: row.driver_id as string, driverName: driver.full_name, driverRole: driver.driver_kind }] : [];
    }),
    remittances: (remittances.data ?? []).map((row) => {
      const driver = one(row.drivers as DriverEmbed);
      const payments = (row.remittance_payments as { amount_centavos: number; deleted_at: string | null }[] | null) ?? [];
      return {
        id: row.id, unit_id: row.unit_id, driver_id: row.driver_id, disposition: row.disposition as Disposition,
        amount_due_centavos: Number(row.amount_due_centavos), allowance_centavos: Number(row.allowance_centavos), deposit_centavos: Number(row.deposit_centavos),
        notes: row.notes, updated_at: row.updated_at,
        driverName: driver?.full_name ?? "Unknown driver", driverRole: driver?.driver_kind ?? "primary",
        payments: payments.filter((payment) => !payment.deleted_at).map((payment) => ({ amount_centavos: Number(payment.amount_centavos) })),
      };
    }),
  };
}

/** Demo mode: the same shapes from lib/demo/mode.ts. Demo remittances are saved under that day's assignment. */
function demoDailyRows(date: string): DailyRows {
  const assignments = demoUnitAssignmentsDaily.filter((row) => row.service_date === date);
  const assignedTo = new Map(assignments.map((row) => [row.unit_id, row]));
  return {
    units: demoUnits.map(({ id, name, body_number, created_at, archived }) => ({ id, name, body_number, created_at, archived })),
    statusChanges: demoUnitStatusChanges.map((change) => ({ ...change })) as (StatusChange & { unit_id: string })[],
    assignments: assignments.map((row) => ({ unit_id: row.unit_id, driver_id: row.driver_id, driverName: row.driverName, driverRole: row.driverKind })),
    remittances: demoRemittances.flatMap((row, index) => {
      const unitId = demoUnits[index % 3].id;
      const assignment = assignedTo.get(unitId);
      if (row.service_date !== date || !assignment) return [];
      const driver = demoDrivers.find((candidate) => candidate.id === assignment.driver_id);
      return [{
        id: row.id, unit_id: unitId, driver_id: assignment.driver_id, disposition: row.disposition as Disposition,
        amount_due_centavos: row.amount_due_centavos, allowance_centavos: row.allowance_centavos, deposit_centavos: row.deposit_centavos, notes: row.notes || null, updated_at: row.updated_at,
        driverName: assignment.driverName, driverRole: (driver?.driver_kind ?? "primary") as DriverRole, payments: row.remittance_payments,
      }];
    }),
  };
}
