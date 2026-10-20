"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession } from "@/lib/auth/guards";
import { paymentSchema, remittanceNotesSchema, remittanceSchema } from "@/lib/validation/remittances";

export async function createRemittance(input: unknown) {
  await requireApprovedSession();
  const value = remittanceSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("remittances").select().eq("idempotency_key", value.idempotencyKey).maybeSingle();
  if (existing) return existing;
  const { data: assignment } = await supabase.from("driver_assignments").select("id, unit_id, driver_id").eq("id", value.assignmentId).maybeSingle();
  if (!assignment) throw new Error("Choose an active driver assignment for this date");
  const { data, error } = await supabase.from("remittances").insert({ assignment_id: value.assignmentId, unit_id: assignment.unit_id, driver_id: assignment.driver_id, service_date: value.serviceDate, disposition: value.disposition, amount_due_centavos: value.disposition === "overnight_overtime" ? 30000 : 18000, notes: value.notes ?? null, idempotency_key: value.idempotencyKey }).select().single();
  if (error) throw new Error("Could not save remittance. Check assignment, date, and duplicate submissions.");
  revalidatePath("/remittances");
  return data;
}

export async function updateRemittanceNotes(input: unknown) {
  await requireApprovedSession();
  const value = remittanceNotesSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("remittances").update({ notes: value.notes }).eq("id", value.remittanceId).select().single();
  if (error) throw new Error("Could not update remittance notes");
  revalidatePath("/remittances");
  return data;
}

export async function addRemittancePayment(input: unknown) {
  await requireApprovedSession();
  const value = paymentSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("remittance_payments").select().eq("idempotency_key", value.idempotencyKey).maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase.from("remittance_payments").insert({ remittance_id: value.remittanceId, paid_at: value.paidAt ?? new Date().toISOString(), amount_centavos: value.amountCentavos, notes: value.notes ?? null, idempotency_key: value.idempotencyKey }).select().single();
  if (error) throw new Error("Could not save payment. Check the amount and remittance.");
  revalidatePath("/remittances");
  return data;
}
