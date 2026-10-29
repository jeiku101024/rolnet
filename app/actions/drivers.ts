"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { driverDetailsSchema, driverSchema, driverStatusSchema } from "@/lib/validation/drivers";
import { driverStatusLabel, driverStatusOf } from "@/lib/status/record-status";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";

const labels = { fullName: "full name", driverKind: "driver type", licenseNumber: "license number", licenseExpiryDate: "license expiry date", phone: "phone number", address: "address" };

function row(value: ReturnType<typeof driverSchema.parse>) {
  return { full_name: value.fullName, driver_kind: value.driverKind, license_number: value.licenseNumber, license_expiry_date: value.licenseExpiryDate, phone: value.phone, address: value.address || null };
}

export async function createDriver(input: unknown) {
  return run("Could not save the driver. Check the license and required details.", async () => {
    await requirePermission("manage_master_data");
    const value = driverSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("drivers").insert(row(value)).select("id").single();
    if (error) throw error;
    revalidatePath("/drivers");
    return { id: data.id as string };
  }, labels);
}

/** Edits a driver's details. The status is changed only through setDriverStatus. */
export async function updateDriver(id: string, input: unknown) {
  return run("Could not update the driver. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = driverDetailsSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("drivers").update(row(value)).eq("id", id).eq("updated_at", value.expectedUpdatedAt).is("deleted_at", null).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionError("STALE_RECORD", "This driver was changed by someone else. Reload the page to see the latest details.");
    revalidatePath("/drivers");
    revalidatePath(`/drivers/${id}`);
    return { id: data.id as string };
  }, labels);
}

/**
 * Sets a driver Active or Inactive (feature 005), with the same stale-view and retry handling as
 * setUnitStatus. The database refuses Inactive while the driver has current or upcoming
 * assignments, and that message is shown as is.
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
      revalidatePath("/drivers");
      revalidatePath(`/drivers/${value.id}`);
    }
    return { id: found.id, status: driverStatusOf(found.is_active), updatedAt: found.updated_at };
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
