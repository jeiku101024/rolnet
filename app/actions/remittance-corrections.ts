"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { run } from "@/lib/actions/run";

const correctionSchema = z.object({ id: z.string().uuid(), reason: z.string().trim().min(3).max(500) });
const labels = { reason: "reason (at least 3 characters)" };

/** Owner-only: reverses (soft-deletes, audited with the reason) a wrong remittance (FR-013a). */
export async function reverseRemittance(remittanceId: string, reason: string) {
  return run("Could not reverse the remittance. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = correctionSchema.parse({ id: remittanceId, reason });
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("reverse_remittance", { p_remittance_id: value.id, p_reason: value.reason });
    if (error) throw error;
    revalidatePath("/remittances");
    revalidatePath("/dashboard");
    return null;
  }, labels);
}

/** Owner-only: voids a wrong payment (audited with the reason); a correct payment can then be added. */
export async function correctRemittancePayment(paymentId: string, remittanceId: string, reason: string) {
  return run("Could not correct the payment. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = correctionSchema.parse({ id: paymentId, reason });
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("correct_remittance_payment", { p_payment_id: value.id, p_reason: value.reason });
    if (error) throw error;
    revalidatePath("/remittances");
    revalidatePath(`/remittances/${remittanceId}`);
    revalidatePath("/dashboard");
    return null;
  }, labels);
}
