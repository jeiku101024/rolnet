"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";

export async function reverseRemittance(remittanceId: string, reason: string) {
  await requirePermission("manage_master_data");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reverse_remittance", { p_remittance_id: remittanceId, p_reason: reason });
  if (error) throw new Error("Could not reverse remittance");
  revalidatePath("/remittances");
}

export async function softDeleteRemittance(remittanceId: string) {
  return reverseRemittance(remittanceId, "Owner soft-deleted remittance");
}
