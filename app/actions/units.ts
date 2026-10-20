"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { unitSchema } from "@/lib/validation/units";

export async function createUnit(input: unknown) {
  await requirePermission("manage_master_data");
  const value = unitSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("units").insert({ body_number: value.bodyNumber, plate_number: value.plateNumber, make_model: value.makeModel, status: value.status }).select().single();
  if (error) throw new Error("Could not create unit");
  revalidatePath("/units");
  return data;
}

export async function updateUnit(id: string, input: unknown) {
  await requirePermission("manage_master_data");
  const value = unitSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("units").update({ body_number: value.bodyNumber, plate_number: value.plateNumber, make_model: value.makeModel, status: value.status }).eq("id", id).select().single();
  if (error) throw new Error("Could not update unit");
  revalidatePath("/units");
  return data;
}

export async function softDeleteUnit(id: string) {
  await requirePermission("manage_master_data");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("units").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error("Could not archive unit");
  revalidatePath("/units");
}
