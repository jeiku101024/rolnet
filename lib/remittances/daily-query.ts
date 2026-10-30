import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { demoDrivers, demoRemittances, demoUnitAssignments, demoUnitDaysOff, demoUnits } from "@/lib/demo/mode";
import type { DayOffRow } from "@/lib/assignments/coverage";
import type { DailyRows, Disposition } from "@/lib/remittances/daily-board";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Embed<T> = T | T[] | null;

/**
 * One date's rows for Daily view (feature 008, research R2): units, the assignments and days off in
 * effect on the date, the date's remittances with their payments and the assignment each was saved
 * under, and (owners only) drivers who could cover as backup. `null` reads the demo data.
 */
export async function loadDailyRows(supabase: Supabase | null, date: string, isOwner: boolean): Promise<DailyRows> {
  if (!supabase) return demoDailyRows(date, isOwner);
  const [units, assignments, daysOff, remittances, drivers] = await Promise.all([
    supabase.from("units").select("id, name, body_number, status").is("deleted_at", null),
    // Primaries whose range covers the date; backups cover only their start date, which this also matches.
    supabase.from("driver_assignments").select("id, unit_id, assignment_type, starts_on, ends_on, driver_id, covered_primary_assignment_id, drivers(full_name)").is("deleted_at", null).lte("starts_on", date).or(`ends_on.is.null,ends_on.gte.${date}`),
    supabase.from("driver_days_off").select("id, primary_assignment_id, day_off_date, notes").eq("day_off_date", date).is("deleted_at", null),
    supabase.from("remittances").select("id, unit_id, driver_id, assignment_id, disposition, amount_due_centavos, notes, updated_at, drivers(full_name), driver_assignments(assignment_type, covered_primary_assignment_id), remittance_payments(amount_centavos, deleted_at)").eq("service_date", date).is("deleted_at", null),
    isOwner ? supabase.from("drivers").select("id, full_name, is_active, license_expiry_date").is("deleted_at", null).eq("is_active", true).gte("license_expiry_date", date) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [units, assignments, daysOff, remittances, drivers]) if (result.error) throw result.error;

  // An assignment whose driver is archived comes back without a name (drivers RLS hides deleted rows); drop it.
  const assignmentRows: DailyRows["assignments"] = (assignments.data ?? []).flatMap(({ drivers: driver, ...row }) => {
    const name = one(driver as Embed<{ full_name: string }>)?.full_name;
    return name ? [{ ...row, driverName: name }] : [];
  });
  const driverOf = new Map(assignmentRows.map((row) => [row.id, row.driverName]));
  return {
    units: units.data ?? [],
    assignments: assignmentRows,
    daysOff: (daysOff.data ?? []) as DayOffRow[],
    remittances: (remittances.data ?? []).map((row) => {
      const assignment = one(row.driver_assignments as Embed<{ assignment_type: "primary" | "backup"; covered_primary_assignment_id: string | null }>);
      const payments = (row.remittance_payments as { amount_centavos: number; deleted_at: string | null }[] | null) ?? [];
      return {
        id: row.id, unit_id: row.unit_id, driver_id: row.driver_id, assignment_id: row.assignment_id, disposition: row.disposition as Disposition,
        amount_due_centavos: Number(row.amount_due_centavos), notes: row.notes, updated_at: row.updated_at,
        driverName: one(row.drivers as Embed<{ full_name: string }>)?.full_name ?? "Unknown driver",
        assignmentType: assignment?.assignment_type ?? "primary",
        coveringFor: assignment?.covered_primary_assignment_id ? driverOf.get(assignment.covered_primary_assignment_id) ?? null : null,
        payments: payments.filter((payment) => !payment.deleted_at).map((payment) => ({ amount_centavos: Number(payment.amount_centavos) })),
      };
    }),
    drivers: (drivers.data ?? []) as DailyRows["drivers"],
  };
}

/** Demo mode: the same shapes from lib/demo/mode.ts (research R12). */
function demoDailyRows(date: string, isOwner: boolean): DailyRows {
  const assignments = demoUnitAssignments.filter((row) => row.starts_on <= date && (!row.ends_on || row.ends_on >= date));
  const primaryOf = new Map(assignments.filter((row) => row.assignment_type === "primary").map((row) => [row.unit_id, row]));
  return {
    units: demoUnits.map(({ id, name, body_number, status }) => ({ id, name, body_number, status })),
    assignments,
    daysOff: demoUnitDaysOff.filter((row) => row.day_off_date === date),
    remittances: demoRemittances.filter((row) => row.service_date === date && primaryOf.has(row.unit_id)).map((row) => ({
      id: row.id, unit_id: row.unit_id, driver_id: row.driver_id, assignment_id: primaryOf.get(row.unit_id)!.id, disposition: row.disposition as Disposition,
      amount_due_centavos: row.amount_due_centavos, notes: row.notes || null, updated_at: row.updated_at,
      driverName: demoDrivers.find((driver) => driver.id === row.driver_id)?.full_name ?? "Unknown driver",
      assignmentType: "primary", coveringFor: null, payments: row.remittance_payments,
    })),
    drivers: isOwner ? demoDrivers.filter((driver) => driver.is_active && driver.license_expiry_date >= date) : [],
  };
}
