"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { backupAssignmentSchema, dayOffSchema, primaryAssignmentSchema } from "@/lib/validation/drivers";

export async function createPrimaryAssignment(input: unknown) {
  await requirePermission("manage_master_data");
  const value = primaryAssignmentSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("driver_assignments").insert({ unit_id: value.unitId, driver_id: value.driverId, assignment_type: "primary", starts_on: value.startsOn, ends_on: value.endsOn ?? null, reason: "primary" }).select().single();
  if (error) throw new Error("This assignment conflicts with an existing unit, driver, or license rule");
  revalidatePath("/units");
  revalidatePath("/drivers");
  return data;
}

export async function recordDayOff(input: unknown) {
  await requirePermission("manage_master_data");
  const value = dayOffSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("driver_days_off").insert({ primary_assignment_id: value.primaryAssignmentId, day_off_date: value.dayOffDate, notes: value.notes ?? null }).select().single();
  if (error) throw new Error("Day off must be inside the primary assignment and unique for that date");
  revalidatePath("/units");
  revalidatePath("/drivers");
  return data;
}

export async function assignBackupDriver(input: unknown) {
  await requirePermission("manage_master_data");
  const value = backupAssignmentSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data: dayOff, error: dayOffError } = await supabase.from("driver_days_off").select("id, day_off_date, primary_assignment_id, driver_assignments(unit_id)").eq("id", value.dayOffId).single();
  if (dayOffError || !dayOff) throw new Error("Day off could not be found");
  const assignment = (dayOff.driver_assignments as { unit_id: string }[])[0];
  if (!assignment) throw new Error("Day off assignment could not be found");
  const { data, error } = await supabase.from("driver_assignments").insert({ unit_id: assignment.unit_id, driver_id: value.backupDriverId, assignment_type: "backup", starts_on: dayOff.day_off_date, ends_on: dayOff.day_off_date, covered_primary_assignment_id: dayOff.primary_assignment_id, reason: "day_off" }).select().single();
  if (error) throw new Error("Backup driver or unit already has coverage on this date");
  revalidatePath("/units");
  revalidatePath("/drivers");
  return data;
}
