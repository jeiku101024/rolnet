"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { backupAssignmentSchema, dayOffSchema, endAssignmentSchema, primaryAssignmentSchema } from "@/lib/validation/drivers";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";
import { addDays } from "@/lib/dates/fleet-date";
import { one } from "@/lib/supabase/embed";

function revalidateAssignments(unitId?: string, driverIds: (string | undefined)[] = []) {
  revalidatePath("/units");
  revalidatePath("/drivers");
  revalidatePath("/remittances");
  if (unitId) revalidatePath(`/units/${unitId}`);
  for (const id of driverIds) if (id) revalidatePath(`/drivers/${id}`);
}

export async function createPrimaryAssignment(input: unknown) {
  return run("Could not save the assignment. Check the unit, driver and dates.", async () => {
    await requirePermission("manage_master_data");
    const value = primaryAssignmentSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    // Reassignment: end the open primary assignment the day before the new driver starts. If the new
    // assignment is then rejected, the old one is reopened so the unit is never left without a driver.
    let ended: { id: string; ends_on: string | null; driver_id: string } | null = null;
    if (value.endCurrent) {
      const { data: current, error } = await supabase.from("driver_assignments").select("id, starts_on, ends_on, driver_id").eq("unit_id", value.unitId).eq("assignment_type", "primary").is("deleted_at", null).lte("starts_on", value.startsOn).or(`ends_on.is.null,ends_on.gte.${value.startsOn}`).order("starts_on", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (current) {
        const endsOn = addDays(value.startsOn, -1);
        if (endsOn < current.starts_on) throw new ActionError("INVALID_DATES", "The new driver must start after the current driver's start date.");
        const { error: endError } = await supabase.from("driver_assignments").update({ ends_on: endsOn }).eq("id", current.id);
        if (endError) throw endError;
        ended = current;
      }
    }
    const { data, error } = await supabase.from("driver_assignments").insert({ unit_id: value.unitId, driver_id: value.driverId, assignment_type: "primary", starts_on: value.startsOn, ends_on: value.endsOn ?? null, reason: "primary" }).select("id").single();
    if (error) {
      if (ended) await supabase.from("driver_assignments").update({ ends_on: ended.ends_on }).eq("id", ended.id);
      throw error;
    }
    revalidateAssignments(value.unitId, [value.driverId, ended?.driver_id]);
    return { id: data.id as string };
  }, { unitId: "unit", driverId: "driver", startsOn: "start date", endsOn: "end date" });
}

export async function endPrimaryAssignment(input: unknown) {
  return run("Could not end the assignment. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = endAssignmentSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data: assignment } = await supabase.from("driver_assignments").select("id, unit_id, driver_id, starts_on").eq("id", value.assignmentId).eq("assignment_type", "primary").is("deleted_at", null).maybeSingle();
    if (!assignment) throw new ActionError("NOT_FOUND", "This assignment was not found. Reload the page and try again.");
    if (value.endsOn < assignment.starts_on) throw new ActionError("INVALID_DATES", `The end date must be on or after the start date (${assignment.starts_on}).`);
    const { error } = await supabase.from("driver_assignments").update({ ends_on: value.endsOn }).eq("id", value.assignmentId);
    if (error) throw error;
    revalidateAssignments(assignment.unit_id, [assignment.driver_id]);
    return null;
  }, { endsOn: "end date" });
}

export async function recordDayOff(input: unknown) {
  return run("Could not save the day off. Check the date and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = dayOffSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data: assignment } = await supabase.from("driver_assignments").select("id, unit_id, driver_id, starts_on, ends_on").eq("id", value.primaryAssignmentId).eq("assignment_type", "primary").is("deleted_at", null).maybeSingle();
    if (!assignment) throw new ActionError("NOT_FOUND", "This assignment was not found. Reload the page and try again.");
    if (value.dayOffDate < assignment.starts_on || (assignment.ends_on && value.dayOffDate > assignment.ends_on)) {
      throw new ActionError("INVALID_DATES", `The day off must fall inside the assignment (${assignment.starts_on} to ${assignment.ends_on ?? "no end date"}).`);
    }
    const { data, error } = await supabase.from("driver_days_off").insert({ primary_assignment_id: value.primaryAssignmentId, day_off_date: value.dayOffDate, notes: value.notes || null }).select("id").single();
    if (error) throw error;
    revalidateAssignments(assignment.unit_id, [assignment.driver_id]);
    return { id: data.id as string };
  }, { dayOffDate: "day off date", notes: "notes" });
}

export async function assignBackupDriver(input: unknown) {
  return run("Could not assign the backup driver. Choose another driver or date.", async () => {
    await requirePermission("manage_master_data");
    const value = backupAssignmentSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data: dayOff } = await supabase.from("driver_days_off").select("id, day_off_date, primary_assignment_id, driver_assignments(unit_id, driver_id)").eq("id", value.dayOffId).is("deleted_at", null).maybeSingle();
    const assignment = one(dayOff?.driver_assignments as { unit_id: string; driver_id: string } | { unit_id: string; driver_id: string }[] | null);
    if (!dayOff || !assignment) throw new ActionError("NOT_FOUND", "This day off was not found. Reload the page and try again.");
    if (assignment.driver_id === value.backupDriverId) throw new ActionError("INVALID_INPUT", "Choose a different driver from the one taking the day off.");
    const { data, error } = await supabase.from("driver_assignments").insert({ unit_id: assignment.unit_id, driver_id: value.backupDriverId, assignment_type: "backup", starts_on: dayOff.day_off_date, ends_on: dayOff.day_off_date, covered_primary_assignment_id: dayOff.primary_assignment_id, reason: "day_off" }).select("id").single();
    if (error) throw error;
    revalidateAssignments(assignment.unit_id, [assignment.driver_id, value.backupDriverId]);
    return { id: data.id as string };
  }, { backupDriverId: "backup driver" });
}
