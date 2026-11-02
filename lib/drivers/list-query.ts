import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { demoDriverAbsences, demoDrivers, demoStaleSettings, demoUnitAssignmentsDaily, demoUnits } from "@/lib/demo/mode";
import { defaultStaleSettings, type Absence, type StaleSettings } from "@/lib/drivers/absences";
import type { ListDriver, TodayAssignment } from "@/lib/drivers/list-board";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const absenceColumns = "id, driver_id, absence_type, start_date, end_date, reason, note, cancelled_at, ended_early_on, snoozed_until, updated_at";

/** Stale-leave thresholds from fleet settings (FR-058). `null` reads demo data. */
export async function loadStaleSettings(supabase: Supabase | null): Promise<StaleSettings> {
  if (!supabase) return demoStaleSettings;
  const { data, error } = await supabase.from("fleet_settings").select("stale_leave_amber_days, stale_leave_red_days, stale_leave_snooze_days").eq("id", true).maybeSingle();
  if (error) throw error;
  if (!data) return defaultStaleSettings;
  return { amber: Number(data.stale_leave_amber_days), red: Number(data.stale_leave_red_days), snooze: Number(data.stale_leave_snooze_days) };
}

/**
 * Everything the Drivers list needs (feature 012, research R9): every driver, the absences that cover
 * today or later, today's saved assignments, and the stale thresholds. The fleet is small, so the list
 * is built, filtered, and paged in memory.
 */
export async function loadDriverList(supabase: Supabase | null, today: string): Promise<{ drivers: ListDriver[]; absences: Absence[]; todayAssignments: TodayAssignment[]; settings: StaleSettings }> {
  if (!supabase) {
    return {
      drivers: demoDrivers.map(({ id, full_name, driver_kind, phone, license_number, license_expiry_date, is_active }) => ({ id, full_name, driver_kind: driver_kind as ListDriver["driver_kind"], phone, license_number, license_expiry_date, is_active })),
      absences: demoDriverAbsences.filter((absence) => !absence.cancelled_at && (absence.end_date === null || absence.end_date >= today)),
      todayAssignments: demoUnitAssignmentsDaily.filter((row) => row.service_date === today).map((row) => ({ driver_id: row.driver_id, unit_id: row.unit_id, unitName: demoUnits.find((unit) => unit.id === row.unit_id)?.name ?? "Unit" })),
      settings: demoStaleSettings,
    };
  }
  const [drivers, absences, assignments, settings] = await Promise.all([
    supabase.from("drivers").select("id, full_name, driver_kind, phone, license_number, license_expiry_date, is_active").is("deleted_at", null),
    supabase.from("driver_absences").select(absenceColumns).is("deleted_at", null).is("cancelled_at", null).or(`end_date.is.null,end_date.gte.${today}`),
    supabase.from("unit_assignments").select("driver_id, unit_id, units(name, body_number)").eq("service_date", today).is("deleted_at", null),
    loadStaleSettings(supabase),
  ]);
  for (const result of [drivers, absences, assignments]) if (result.error) throw result.error;
  return {
    drivers: (drivers.data ?? []) as ListDriver[],
    absences: (absences.data ?? []) as Absence[],
    todayAssignments: (assignments.data ?? []).map((row) => {
      const unit = one(row.units as { name: string | null; body_number: string } | { name: string | null; body_number: string }[] | null);
      return { driver_id: row.driver_id as string, unit_id: row.unit_id as string, unitName: unit?.name || unit?.body_number || "Unit" };
    }),
    settings,
  };
}
