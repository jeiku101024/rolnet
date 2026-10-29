"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { driverSchema } from "@/lib/validation/drivers";

export async function createDriver(input: unknown) {
  await requirePermission("manage_master_data");
  const value = driverSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("drivers").insert({ full_name: value.fullName, driver_kind: value.driverKind, license_number: value.licenseNumber, license_expiry_date: value.licenseExpiryDate, phone: value.phone, address: value.address }).select().single();
  if (error) throw new Error("Could not create driver");
  revalidatePath("/drivers");
  return data;
}

export async function updateDriver(id: string, input: unknown) {
  await requirePermission("manage_master_data");
  const value = driverSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("drivers").update({ full_name: value.fullName, driver_kind: value.driverKind, license_number: value.licenseNumber, license_expiry_date: value.licenseExpiryDate, phone: value.phone, address: value.address }).eq("id", id).select().single();
  if (error) throw new Error("Could not update driver");
  revalidatePath("/drivers");
  return data;
}

export async function softDeleteDriver(id: string) {
  await requirePermission("manage_master_data");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("soft_delete_record", { p_table: "drivers", p_id: id });
  if (error || !data) throw new Error("Could not archive driver. Reload the page and try again.");
  revalidatePath("/drivers");
}
