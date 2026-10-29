"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession, requirePermission } from "@/lib/auth/guards";
import { partSchema } from "@/lib/validation/maintenance";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";

export async function logPartReplacement(input: unknown) {
  return run("Could not save the part replacement. Check the details and try again.", async () => {
    await requireApprovedSession();
    const v = partSchema.parse(input);
    const s = await createSupabaseServerClient();
    const { data, error } = await s.from("part_replacements").insert({ unit_id: v.unitId, part_name: v.partName, cost_centavos: v.costCentavos, replaced_on: v.replacedOn, replacement_mileage: v.replacementMileage ?? null, next_due_date: v.nextDueDate ?? null, next_due_mileage: v.nextDueMileage ?? null, notes: v.notes || null }).select("id").single();
    if (error) throw error;
    revalidatePath("/maintenance");
    revalidatePath(`/maintenance/${v.unitId}`);
    revalidatePath("/dashboard");
    return { id: data.id as string };
  }, { partName: "part name", costCentavos: "cost", replacedOn: "replacement date", replacementMileage: "replacement mileage", nextDueDate: "next due date", nextDueMileage: "next due mileage" });
}

export async function softDeletePart(id: string) {
  return run("Could not archive the part replacement. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const s = await createSupabaseServerClient();
    const { data, error } = await s.rpc("soft_delete_record", { p_table: "part_replacements", p_id: id });
    if (error) throw error;
    if (!data) throw new ActionError("STALE_RECORD", "This part replacement was already archived. Reload the page.");
    revalidatePath("/maintenance", "layout");
    revalidatePath("/dashboard");
    return null;
  });
}
