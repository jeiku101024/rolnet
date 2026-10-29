"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { unitSchema } from "@/lib/validation/units";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";

const labels = { bodyNumber: "body number", plateNumber: "plate number", makeModel: "make and model", status: "status" };

export async function createUnit(input: unknown) {
  return run("Could not save the unit. Check the details and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = unitSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("units").insert({ body_number: value.bodyNumber, plate_number: value.plateNumber, make_model: value.makeModel, status: value.status }).select("id").single();
    if (error) throw error;
    revalidatePath("/units");
    return { id: data.id as string };
  }, labels);
}

export async function updateUnit(id: string, input: unknown) {
  return run("Could not update the unit. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = unitSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("units").update({ body_number: value.bodyNumber, plate_number: value.plateNumber, make_model: value.makeModel, status: value.status }).eq("id", id).select("id").single();
    if (error) throw error;
    revalidatePath("/units");
    revalidatePath(`/units/${id}`);
    return { id: data.id as string };
  }, labels);
}

export async function softDeleteUnit(id: string) {
  return run("Could not archive the unit. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("soft_delete_record", { p_table: "units", p_id: id });
    if (error) throw error;
    if (!data) throw new ActionError("STALE_RECORD", "This unit was already archived or changed. Reload the page.");
    revalidatePath("/units");
    return null;
  });
}
