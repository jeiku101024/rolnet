"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { addDays, fleetToday } from "@/lib/dates/fleet-date";
import { one } from "@/lib/supabase/embed";
import { absenceToast, conflictMessage, covers, overlaps, type Absence } from "@/lib/drivers/absences";
import { absenceActionSchema, absenceFieldLabels, absenceInputSchema, endAbsenceSchema, saveAbsenceSchema, type AbsenceInput } from "@/lib/validation/driver-absences";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";

// Feature 012 (contracts/actions.md): dated absences. Owner and staff (FR-050). The database function
// save_driver_absence re-checks every rule and releases assignments in the same transaction (R5).

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const absenceColumns = "id, driver_id, absence_type, start_date, end_date, reason, note, cancelled_at, ended_early_on, snoozed_until, updated_at";

export interface ReleaseRow { id: string; date: string; unitName: string }
export interface AbsencePreview { conflict: string | null; past: { assignments: number; remittances: number }; release: ReleaseRow[] }

function revalidateAbsencePaths(driverId: string) {
  revalidatePath("/drivers");
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/units");
  revalidatePath("/remittances");
  revalidatePath("/dashboard");
}

async function readDriver(supabase: Supabase, driverId: string) {
  const { data, error } = await supabase.from("drivers").select("id, full_name, is_active").eq("id", driverId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new ActionError("NOT_FOUND", "This driver was not found or has been archived. Reload the page.");
  return data as { id: string; full_name: string; is_active: boolean };
}

/** What saving would do: an overlap conflict, past records in the range, and assignments it would release. */
async function previewFor(supabase: Supabase, value: AbsenceInput): Promise<AbsencePreview> {
  const today = fleetToday();
  const driver = await readDriver(supabase, value.driverId);
  if (!driver.is_active) throw new ActionError("DRIVER_INACTIVE", "Inactive drivers cannot have absences");
  const [absences, assignments, remittances] = await Promise.all([
    supabase.from("driver_absences").select(absenceColumns).eq("driver_id", value.driverId).is("deleted_at", null).is("cancelled_at", null),
    supabase.from("unit_assignments").select("id, service_date, units(name, body_number)").eq("driver_id", value.driverId).is("deleted_at", null).gte("service_date", value.startDate).order("service_date"),
    value.startDate < today
      ? supabase.from("remittances").select("id", { count: "exact", head: true }).eq("driver_id", value.driverId).is("deleted_at", null).gte("service_date", value.startDate).lte("service_date", minDate(value.endDate, addDays(today, -1)))
      : Promise.resolve({ count: 0, error: null }),
  ]);
  for (const result of [absences, assignments, remittances]) if (result.error) throw result.error;
  const rows = (absences.data ?? []) as Absence[];
  const old = value.id ? rows.find((absence) => absence.id === value.id) ?? null : null;
  const clash = rows.filter((absence) => absence.id !== value.id).sort((a, b) => a.start_date.localeCompare(b.start_date))
    .find((absence) => overlaps(absence, value.startDate, value.endDate));
  const inRange = (date: string) => date >= value.startDate && (value.endDate === null || date <= value.endDate);
  const dated = (assignments.data ?? []).filter((row) => inRange(row.service_date as string));
  const release = dated
    .filter((row) => (row.service_date as string) >= today && !(old && covers(old, row.service_date as string)))
    .map((row) => { const unit = one(row.units as { name: string | null; body_number: string } | { name: string | null; body_number: string }[] | null); return { id: row.id as string, date: row.service_date as string, unitName: unit?.name || unit?.body_number || "Unit" }; });
  return {
    conflict: clash ? conflictMessage(driver.full_name, clash) : null,
    past: { assignments: dated.filter((row) => (row.service_date as string) < today).length, remittances: remittances.count ?? 0 },
    release,
  };
}

function minDate(a: string | null, b: string) {
  return a !== null && a < b ? a : b;
}

export async function previewAbsence(input: unknown) {
  return run("Could not check these dates. Reload the page and try again.", async () => {
    await requirePermission("encode_operations");
    const value = absenceInputSchema.parse(input);
    return previewFor(await createSupabaseServerClient(), value);
  }, absenceFieldLabels);
}

/** Adds or edits an absence, releasing exactly the assignments the user confirmed (FR-042). */
export async function saveAbsence(input: unknown) {
  return run("Could not save the absence. Reload the page and try again.", async () => {
    await requirePermission("encode_operations");
    const value = absenceInputSchema.parse(input);
    const { releaseIds } = saveAbsenceSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const driver = await readDriver(supabase, value.driverId);
    const { data, error } = await supabase.rpc("save_driver_absence", {
      p_id: value.id ?? null, p_driver_id: value.driverId, p_type: value.type, p_start: value.startDate, p_end: value.endDate,
      p_reason: value.reason, p_note: value.note ?? null, p_release_ids: releaseIds, p_expected_updated_at: value.expectedUpdatedAt ?? null,
    }).single();
    if (error) throw error;
    const saved = data as Absence;
    revalidateAbsencePaths(value.driverId);
    return { absence: saved, toast: absenceToast(driver.full_name, saved) };
  }, absenceFieldLabels);
}

/** Cancels an upcoming absence (FR-047). */
export async function cancelAbsence(input: unknown) {
  return run("Could not cancel the absence. Reload the page and try again.", async () => {
    await requirePermission("encode_operations");
    const value = absenceActionSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("cancel_driver_absence", { p_id: value.id, p_expected_updated_at: value.expectedUpdatedAt }).single();
    if (error) throw error;
    const saved = data as Absence;
    revalidateAbsencePaths(saved.driver_id);
    return { absence: saved, toast: "Absence cancelled" };
  });
}

/** Ends an absence covering today, optionally cancelling upcoming ones too (FR-045, End early, End leave now). */
export async function endAbsence(input: unknown) {
  return run("Could not end the absence. Reload the page and try again.", async () => {
    await requirePermission("encode_operations");
    const value = endAbsenceSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("end_driver_absence", { p_id: value.id, p_expected_updated_at: value.expectedUpdatedAt, p_cancel_upcoming: value.cancelUpcoming }).single();
    if (error) throw error;
    const saved = data as Absence;
    const driver = await readDriver(supabase, saved.driver_id);
    revalidateAbsencePaths(saved.driver_id);
    const toast = saved.absence_type === "day_off" ? `${driver.full_name} is Active again` : `Leave ended. ${driver.full_name} is available for assignment`;
    return { absence: saved, toast };
  });
}

/** "Still on leave": logs the check and hides the stale flag for the snooze period (FR-055). */
export async function confirmLeave(input: unknown) {
  return run("Could not mark the leave as checked. Reload the page and try again.", async () => {
    await requirePermission("encode_operations");
    const value = absenceActionSchema.pick({ id: true }).parse(input);
    const supabase = await createSupabaseServerClient();
    const [{ data, error }, settings] = await Promise.all([
      supabase.rpc("confirm_driver_leave", { p_id: value.id }).single(),
      supabase.from("fleet_settings").select("stale_leave_snooze_days").eq("id", true).maybeSingle(),
    ]);
    if (error) throw error;
    const saved = data as Absence;
    const days = (settings.data?.stale_leave_snooze_days as number | undefined) ?? 7;
    revalidateAbsencePaths(saved.driver_id);
    return { absence: saved, toast: `Marked as still on leave. Flag hidden for ${days} days.` };
  });
}
