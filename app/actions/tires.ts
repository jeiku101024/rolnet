"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession, requirePermission } from "@/lib/auth/guards";
import { tireSchema } from "@/lib/validation/maintenance";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";

export async function installTire(input: unknown) {
  return run("Could not save the tire. Check the details and try again.", async () => {
    await requireApprovedSession();
    const v = tireSchema.parse(input);
    const s = await createSupabaseServerClient();
    const { data: old, error: lookupError } = await s.from("tire_installations").select("id").eq("unit_id", v.unitId).eq("position", v.position).is("replaced_by_id", null).is("deleted_at", null).maybeSingle();
    if (lookupError) throw lookupError;
    const replacement = { brand: v.brand, installed_on: v.installedOn, installed_mileage: v.installedMileage ?? null, cost_centavos: v.costCentavos, next_due_date: v.nextDueDate ?? null, next_due_mileage: v.nextDueMileage ?? null };
    // A replacement goes through replace_tire_installation(), which retires the current tire and
    // inserts the new one in one transaction; the old tire stays as history.
    const { data, error } = old
      ? await s.rpc("replace_tire_installation", { p_current_id: old.id, p_replacement: replacement })
      : await s.from("tire_installations").insert({ ...replacement, unit_id: v.unitId, position: v.position, replaced_by_id: null }).select("id").single();
    if (error) throw error;
    if (!data) throw new ActionError("UNEXPECTED", "The tire was not saved. Try again.");
    revalidatePath("/maintenance");
    revalidatePath(`/maintenance/${v.unitId}`);
    revalidatePath("/dashboard");
    return { id: (data as { id: string }).id, replaced: Boolean(old) };
  }, { position: "position", brand: "brand", installedOn: "installation date", installedMileage: "installed mileage", costCentavos: "cost", nextDueDate: "next due date", nextDueMileage: "next due mileage" });
}

export async function softDeleteTire(id: string) {
  return run("Could not archive the tire. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const s = await createSupabaseServerClient();
    const { data, error } = await s.rpc("soft_delete_record", { p_table: "tire_installations", p_id: id });
    if (error) throw error;
    if (!data) throw new ActionError("STALE_RECORD", "This tire was already archived. Reload the page.");
    revalidatePath("/maintenance", "layout");
    revalidatePath("/dashboard");
    return null;
  });
}
