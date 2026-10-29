"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { driverSchema } from "@/lib/validation/drivers";
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

export async function updateDriver(id: string, input: unknown) {
  return run("Could not update the driver. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = driverSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("drivers").update(row(value)).eq("id", id).select("id").single();
    if (error) throw error;
    revalidatePath("/drivers");
    revalidatePath(`/drivers/${id}`);
    return { id: data.id as string };
  }, labels);
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
