"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { unitDetailsSchema, unitSchema, unitStatusSchema } from "@/lib/validation/units";
import { unitStatusLabel, type UnitStatus } from "@/lib/status/record-status";
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

/** Edits a unit's details. The status is changed only through setUnitStatus. */
export async function updateUnit(id: string, input: unknown) {
  return run("Could not update the unit. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = unitDetailsSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("units").update({ body_number: value.bodyNumber, plate_number: value.plateNumber, make_model: value.makeModel }).eq("id", id).eq("updated_at", value.expectedUpdatedAt).is("deleted_at", null).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionError("STALE_RECORD", "This unit was changed by someone else. Reload the page to see the latest details.");
    revalidatePath("/units");
    revalidatePath(`/units/${id}`);
    return { id: data.id as string };
  }, labels);
}

/**
 * Sets a unit's status (feature 005). The update only applies while the unit still has the status
 * the screen showed, so a change from a stale view is refused; a retry of a change that already
 * went through, or picking the current status again, succeeds without writing.
 */
export async function setUnitStatus(input: unknown) {
  return run("Could not change the unit's status. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = unitStatusSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const read = async () => {
      const { data, error } = await supabase.from("units").select("id, status, updated_at").eq("id", value.id).is("deleted_at", null).maybeSingle();
      if (error) throw error;
      if (!data) throw new ActionError("NOT_FOUND", "This unit was not found or has been archived. Reload the page.");
      return data as { id: string; status: UnitStatus; updated_at: string };
    };
    const current = await read();
    let row = current;
    if (current.status !== value.status) {
      const { data, error } = await supabase.from("units").update({ status: value.status }).eq("id", value.id).eq("status", value.expectedStatus).is("deleted_at", null).select("id, status, updated_at").maybeSingle();
      if (error) throw error;
      if (data) row = data as typeof current;
      else {
        row = await read();
        if (row.status !== value.status) throw new ActionError("STALE_RECORD", `This unit was changed by someone else. It is now ${unitStatusLabel(row.status)}.`);
      }
      revalidatePath("/units");
      revalidatePath(`/units/${value.id}`);
    }
    return { id: row.id, status: row.status, updatedAt: row.updated_at };
  });
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
