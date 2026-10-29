"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession } from "@/lib/auth/guards";
import { paymentSchema, remittanceNotesSchema, remittanceSchema } from "@/lib/validation/remittances";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";

function revalidateRemittance(id?: string) {
  revalidatePath("/remittances");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/remittances/${id}`);
}

export async function createRemittance(input: unknown) {
  return run("Could not save the remittance. Check the assignment and date.", async () => {
    await requireApprovedSession();
    const value = remittanceSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase.from("remittances").select("id").eq("idempotency_key", value.idempotencyKey).maybeSingle();
    if (existing) return { id: existing.id as string };
    const { data: assignment } = await supabase.from("driver_assignments").select("id, unit_id, driver_id").eq("id", value.assignmentId).is("deleted_at", null).maybeSingle();
    if (!assignment) throw new ActionError("NOT_FOUND", "Choose an active driver assignment for this date.");
    // The database recalculates the due from the disposition; the value here only satisfies the column.
    const { data, error } = await supabase.from("remittances").insert({ assignment_id: value.assignmentId, unit_id: assignment.unit_id, driver_id: assignment.driver_id, service_date: value.serviceDate, disposition: value.disposition, amount_due_centavos: value.disposition === "overnight_overtime" ? 30000 : 18000, notes: value.notes || null, idempotency_key: value.idempotencyKey }).select("id").single();
    if (error) throw error;
    revalidateRemittance();
    return { id: data.id as string };
  }, { assignmentId: "assignment", serviceDate: "service date", disposition: "unit disposition", notes: "notes" });
}

export async function updateRemittanceNotes(input: unknown) {
  return run("Could not save the notes. Reload the page and try again.", async () => {
    await requireApprovedSession();
    const value = remittanceNotesSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("remittances").update({ notes: value.notes || null }).eq("id", value.remittanceId).is("deleted_at", null);
    if (value.expectedUpdatedAt) query = query.eq("updated_at", value.expectedUpdatedAt);
    const { data, error } = await query.select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionError("STALE_RECORD", "Someone changed this remittance after you opened it. Reload the page and edit the notes again.");
    revalidateRemittance(value.remittanceId);
    return null;
  }, { notes: "notes (1,000 characters at most)" });
}

export async function addRemittancePayment(input: unknown) {
  return run("Could not save the payment. Check the amount and try again.", async () => {
    await requireApprovedSession();
    const value = paymentSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase.from("remittance_payments").select("id").eq("idempotency_key", value.idempotencyKey).maybeSingle();
    if (existing) return { id: existing.id as string };
    const { data, error } = await supabase.from("remittance_payments").insert({ remittance_id: value.remittanceId, paid_at: value.paidAt ?? new Date().toISOString(), amount_centavos: value.amountCentavos, notes: value.notes || null, idempotency_key: value.idempotencyKey }).select("id").single();
    if (error) throw error;
    revalidateRemittance(value.remittanceId);
    return { id: data.id as string };
  }, { amountCentavos: "payment amount (more than ₱0.00)", paidAt: "payment date", notes: "notes" });
}
