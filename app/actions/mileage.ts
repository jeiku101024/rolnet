"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession } from "@/lib/auth/guards";
import { mileageSchema } from "@/lib/validation/units";
import { run } from "@/lib/actions/run";

/**
 * Records the unit's odometer reading for a date, or corrects that date's reading. The unique
 * index on (unit_id, reading_date) is partial (deleted_at is null), so PostgREST's upsert cannot
 * use it as an ON CONFLICT target; the existing reading is looked up and updated instead (T140).
 */
export async function upsertMileageReading(input: unknown) {
  return run("Could not save the mileage. Check the reading and date.", async () => {
    await requireApprovedSession();
    const value = mileageSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data: existing, error: lookupError } = await supabase.from("mileage_readings").select("id").eq("unit_id", value.unitId).eq("reading_date", value.readingDate).is("deleted_at", null).maybeSingle();
    if (lookupError) throw lookupError;
    const row = { mileage: value.mileage, notes: value.notes || null };
    const { data, error } = existing
      ? await supabase.from("mileage_readings").update(row).eq("id", existing.id).select("id").single()
      : await supabase.from("mileage_readings").insert({ ...row, unit_id: value.unitId, reading_date: value.readingDate }).select("id").single();
    if (error) throw error;
    revalidatePath(`/units/${value.unitId}`);
    revalidatePath(`/maintenance/${value.unitId}`);
    revalidatePath("/maintenance");
    revalidatePath("/units");
    revalidatePath("/dashboard");
    return { id: data.id as string, updated: Boolean(existing) };
  }, { readingDate: "reading date", mileage: "mileage (whole kilometres)", notes: "notes" });
}
