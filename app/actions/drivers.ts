"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { fleetToday } from "@/lib/dates/fleet-date";
import { one } from "@/lib/supabase/embed";
import { availability, type Availability } from "@/lib/drivers/availability";
import { demoDriverAbsences, demoDrivers, demoMode, demoUnitAssignmentsDaily } from "@/lib/demo/mode";
import { driverDetailsSchema, driverIdSchema, driverRoleSchema, driverSchema, driverStatusSchema, previewAvailabilitySchema, undoDriverRoleSchema } from "@/lib/validation/drivers";
import { driverStatusLabel, driverStatusOf } from "@/lib/status/record-status";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";

const labels = { fullName: "full name", driverKind: "role", isActive: "status", licenseNumber: "licence number", licenseExpiryDate: "licence expiry", phone: "contact number", address: "address", notes: "notes (1,000 characters at most)" };

function revalidateDriverPaths(id?: string) {
  revalidatePath("/drivers");
  if (id) revalidatePath(`/drivers/${id}`);
  // New and changed drivers show up in the Units dropdowns and on the Remittances cards (FR-013).
  revalidatePath("/units");
  revalidatePath("/remittances");
}

function detailsRow(value: ReturnType<typeof driverDetailsSchema.parse>) {
  return { full_name: value.fullName, license_number: value.licenseNumber, license_expiry_date: value.licenseExpiryDate, phone: value.phone, address: value.address || null, notes: value.notes || null };
}

export async function createDriver(input: unknown) {
  return run("Could not save the driver. Check the licence and required details.", async () => {
    await requirePermission("manage_master_data");
    const value = driverSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("drivers").insert({
      full_name: value.fullName, driver_kind: value.driverKind, is_active: value.isActive, license_number: value.licenseNumber,
      license_expiry_date: value.licenseExpiryDate, phone: value.phone, address: value.address || null, notes: value.notes || null,
    }).select("id").single();
    if (error) throw error;
    revalidateDriverPaths();
    return { id: data.id as string };
  }, labels);
}

/** Edits a driver's details. The role changes only through setDriverRole and the status through setDriverStatus. */
export async function updateDriver(id: string, input: unknown) {
  return run("Could not update the driver. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = driverDetailsSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("drivers").update(detailsRow(value)).eq("id", id).eq("updated_at", value.expectedUpdatedAt).is("deleted_at", null).select("id, updated_at").maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionError("STALE_RECORD", "This driver was changed by someone else. Reload the page to see the latest details.");
    revalidateDriverPaths(id);
    return { id: data.id as string, updatedAt: data.updated_at as string };
  }, labels);
}

/**
 * Sets a driver Active or Inactive (feature 005), with the same stale-view and retry handling as
 * setUnitStatus. Inactive releases the driver's saved assignments from today onward, except ones with
 * a recorded remittance (feature 010 FR-029b, feature 012 FR-043); the screen confirms the list first
 * with driverReleasePreview.
 */
export async function setDriverStatus(input: unknown) {
  return run("Could not change the driver's status. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = driverStatusSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const read = async () => {
      const { data, error } = await supabase.from("drivers").select("id, is_active, updated_at").eq("id", value.id).is("deleted_at", null).maybeSingle();
      if (error) throw error;
      if (!data) throw new ActionError("NOT_FOUND", "This driver was not found or has been archived. Reload the page.");
      return data as { id: string; is_active: boolean; updated_at: string };
    };
    const current = await read();
    let found = current;
    if (driverStatusOf(current.is_active) !== value.status) {
      const { data, error } = await supabase.from("drivers").update({ is_active: value.status === "active" }).eq("id", value.id).eq("is_active", value.expectedStatus === "active").is("deleted_at", null).select("id, is_active, updated_at").maybeSingle();
      if (error) throw error;
      if (data) found = data as typeof current;
      else {
        found = await read();
        if (driverStatusOf(found.is_active) !== value.status) throw new ActionError("STALE_RECORD", `This driver was changed by someone else. They are now ${driverStatusLabel(driverStatusOf(found.is_active))}.`);
      }
      revalidateDriverPaths(value.id);
    }
    return { id: found.id, status: driverStatusOf(found.is_active), updatedAt: found.updated_at };
  });
}

/** The driver's saved assignments from today onward, for the Inactive confirmation (FR-043). `kept` rows have a remittance and stay. */
export async function driverReleasePreview(input: unknown) {
  return run("Could not check the driver's assignments. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const { id } = driverIdSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const today = fleetToday();
    const { data, error } = await supabase.from("unit_assignments").select("id, unit_id, service_date, units(name, body_number)").eq("driver_id", id).is("deleted_at", null).gte("service_date", today).order("service_date");
    if (error) throw error;
    const rows = data ?? [];
    const { data: remittances, error: remittanceError } = rows.length
      ? await supabase.from("remittances").select("unit_id, service_date").in("unit_id", [...new Set(rows.map((row) => row.unit_id as string))]).gte("service_date", today).is("deleted_at", null)
      : { data: [], error: null };
    if (remittanceError) throw remittanceError;
    const locked = new Set((remittances ?? []).map((row) => `${row.unit_id}:${row.service_date}`));
    return {
      assignments: rows.map((row) => {
        const unit = one(row.units as { name: string | null; body_number: string } | { name: string | null; body_number: string }[] | null);
        return { date: row.service_date as string, unitName: unit?.name || unit?.body_number || "Unit", kept: locked.has(`${row.unit_id}:${row.service_date}`) };
      }),
    };
  });
}

/** Switches Primary/Backup and logs it (FR-024–FR-027). Owner and staff (FR-050). */
export async function setDriverRole(input: unknown) {
  return run("Could not change the driver's role. Reload the page and try again.", async () => {
    await requirePermission("encode_operations");
    const value = driverRoleSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("set_driver_role", { p_driver_id: value.id, p_to_role: value.role, p_expected_updated_at: value.expectedUpdatedAt });
    if (error) throw error;
    const { data: driver, error: readError } = await supabase.from("drivers").select("driver_kind, updated_at").eq("id", value.id).maybeSingle();
    if (readError) throw readError;
    revalidateDriverPaths(value.id);
    return { changeId: (data as string | null) ?? null, role: (driver?.driver_kind ?? value.role) as "primary" | "backup", updatedAt: (driver?.updated_at as string | undefined) ?? value.expectedUpdatedAt };
  });
}

/** Undo from the role toast: reverts the switch and withdraws its history entry (FR-025). */
export async function undoDriverRole(input: unknown) {
  return run("Could not undo the change. Switch the role back instead.", async () => {
    await requirePermission("encode_operations");
    const value = undoDriverRoleSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("undo_driver_role_change", { p_change_id: value.changeId });
    if (error) throw error;
    revalidateDriverPaths(value.driverId);
    return null;
  });
}

/** "Preview dropdown": who the Assign driver dropdown offers on a date, and how many are hidden and why (FR-009). */
export async function previewAvailability(input: unknown) {
  return run<Availability>("Could not load the preview. Reload the page and try again.", async () => {
    await requirePermission("encode_operations");
    const { date } = previewAvailabilitySchema.parse(input);
    if (demoMode) {
      return availability({
        drivers: demoDrivers.map((driver) => ({ ...driver, driver_kind: driver.driver_kind as "primary" | "backup" })),
        absences: demoDriverAbsences,
        assignedDriverIds: demoUnitAssignmentsDaily.filter((row) => row.service_date === date).map((row) => row.driver_id),
        date,
      });
    }
    const supabase = await createSupabaseServerClient();
    const [drivers, absences, assignments] = await Promise.all([
      supabase.from("drivers").select("id, full_name, driver_kind, is_active, license_expiry_date").is("deleted_at", null),
      supabase.from("driver_absences").select("driver_id, start_date, end_date, cancelled_at, ended_early_on").is("deleted_at", null).is("cancelled_at", null).lte("start_date", date).or(`end_date.is.null,end_date.gte.${date}`),
      supabase.from("unit_assignments").select("driver_id").eq("service_date", date).is("deleted_at", null),
    ]);
    for (const result of [drivers, absences, assignments]) if (result.error) throw result.error;
    return availability({
      drivers: (drivers.data ?? []) as Parameters<typeof availability>[0]["drivers"],
      absences: (absences.data ?? []) as Parameters<typeof availability>[0]["absences"],
      assignedDriverIds: (assignments.data ?? []).map((row) => row.driver_id as string),
      date,
    });
  });
}

export async function softDeleteDriver(id: string) {
  return run("Could not archive the driver. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("soft_delete_record", { p_table: "drivers", p_id: id });
    if (error) throw error;
    if (!data) throw new ActionError("STALE_RECORD", "This driver was already archived or changed. Reload the page.");
    revalidatePath("/drivers");
    return null;
  });
}
