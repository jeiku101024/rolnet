"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession } from "@/lib/auth/guards";
import { mileageSchema } from "@/lib/validation/units";

export async function upsertMileageReading(input: unknown) {
  await requireApprovedSession();
  const value = mileageSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("mileage_readings").upsert({ unit_id: value.unitId, reading_date: value.readingDate, mileage: value.mileage, notes: value.notes ?? null }, { onConflict: "unit_id,reading_date" }).select().single();
  if (error) throw new Error("Mileage must be nondecreasing and unique for the date");
  revalidatePath(`/units/${value.unitId}`);
  revalidatePath("/maintenance");
  return data;
}
