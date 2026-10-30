"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession } from "@/lib/auth/guards";
import { dailyRemittanceSchema, editDailyRemittanceSchema, paymentSchema, remittanceNotesSchema, remittanceSchema } from "@/lib/validation/remittances";
import { fleetToday, paymentTimestampFor } from "@/lib/dates/fleet-date";
import { planPaymentChange } from "@/lib/remittances/payment-plan";
import { hasPermission } from "@/lib/permissions/roles";
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

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Inserts one payment unless this idempotency key already saved it (retries never add a second payment). */
async function insertPayment(supabase: Supabase, remittanceId: string, amountCentavos: number, paidAt: string, key: string) {
  const { data: existing } = await supabase.from("remittance_payments").select("id").eq("idempotency_key", key).maybeSingle();
  if (existing) return;
  const { error } = await supabase.from("remittance_payments").insert({ remittance_id: remittanceId, paid_at: paidAt, amount_centavos: amountCentavos, idempotency_key: key });
  if (error) throw error;
}

/**
 * Feature 008: records an unrecorded Daily view card (FR-020, FR-020a, FR-028). The payment is dated
 * on the card's date. If only the payment fails, the remittance stays saved and the message says how
 * to finish (constitution III, multi-step clause).
 */
export async function saveDailyRemittance(input: unknown) {
  return run("Could not save the remittance. Reload the page and try again.", async () => {
    await requireApprovedSession();
    const value = dailyRemittanceSchema.parse(input);
    if (value.serviceDate > fleetToday()) throw new ActionError("INVALID_DATES", "Remittances can't be recorded for a future date.");
    const supabase = await createSupabaseServerClient();
    let saved = (await supabase.from("remittances").select("id, updated_at").eq("idempotency_key", value.remittanceKey).maybeSingle()).data;
    if (!saved) {
      const { data: assignment } = await supabase.from("driver_assignments").select("id, unit_id, driver_id").eq("id", value.assignmentId).is("deleted_at", null).maybeSingle();
      if (!assignment) throw new ActionError("NOT_FOUND", "The driver wasn't assigned to this unit on this date. Reload the page.");
      // The database sets the due from the disposition; the value here only satisfies the column.
      const { data, error } = await supabase.from("remittances").insert({ assignment_id: assignment.id, unit_id: assignment.unit_id, driver_id: assignment.driver_id, service_date: value.serviceDate, disposition: value.disposition, amount_due_centavos: value.disposition === "overnight_overtime" ? 30000 : 18000, notes: value.notes || null, idempotency_key: value.remittanceKey }).select("id, updated_at").single();
      if (error) throw error;
      saved = data;
    }
    revalidateRemittance();
    const payment = value.paymentCentavos ?? 0;
    if (payment > 0) {
      try {
        await insertPayment(supabase, saved.id, payment, paymentTimestampFor(value.serviceDate), value.paymentKey);
      } catch (error) {
        console.error("Daily remittance payment failed", error);
        return { id: saved.id as string, updatedAt: saved.updated_at as string, receivedCentavos: 0, partial: "The remittance was saved, but the payment was not. Edit the card to add the payment." };
      }
    }
    return { id: saved.id as string, updatedAt: saved.updated_at as string, receivedCentavos: payment, partial: null as string | null };
  }, { assignmentId: "driver assignment", serviceDate: "date", disposition: "disposition", notes: "notes (1,000 characters at most)", paymentCentavos: "payment received" });
}

/**
 * Feature 008: saves an edited, saved Daily view card (FR-024, FR-026, FR-027). Notes change with a
 * stale-record check; raising the payment adds the difference; an owner lowering it voids the
 * active payments (audited, with the reason) and then records the new total. Writes run void first,
 * insert last, and a retry re-reads the payments, so it finishes the same change (research R5).
 */
export async function editDailyRemittance(input: unknown) {
  return run("Could not save the changes. Reload the page and try again.", async () => {
    const profile = await requireApprovedSession();
    const value = editDailyRemittanceSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data: remittance } = await supabase.from("remittances").select("id, service_date, notes, updated_at, remittance_payments(id, amount_centavos, deleted_at)").eq("id", value.remittanceId).is("deleted_at", null).maybeSingle();
    if (!remittance) throw new ActionError("NOT_FOUND", "This remittance was not found. Reload the page.");
    let updatedAt = remittance.updated_at as string;
    if ((remittance.notes ?? "") !== value.notes) {
      const { data, error } = await supabase.from("remittances").update({ notes: value.notes || null }).eq("id", remittance.id).eq("updated_at", value.expectedUpdatedAt).is("deleted_at", null).select("updated_at").maybeSingle();
      if (error) throw error;
      if (!data) throw new ActionError("STALE_RECORD", "Someone changed this remittance after you opened it. Reload the card and edit again.");
      updatedAt = data.updated_at as string;
    }
    const active = ((remittance.remittance_payments as { id: string; amount_centavos: number; deleted_at: string | null }[] | null) ?? []).filter((payment) => !payment.deleted_at);
    const current = active.reduce((sum, payment) => sum + Number(payment.amount_centavos), 0);
    const plan = planPaymentChange({ currentCentavos: current, targetCentavos: value.targetPaymentCentavos, isOwner: hasPermission(profile.role, "manage_master_data") });
    const paidAt = paymentTimestampFor(remittance.service_date as string);
    if (plan.kind === "blocked") throw new ActionError("FORBIDDEN", "Only the owner can lower a recorded payment.");
    if (plan.kind === "add") await insertPayment(supabase, remittance.id, plan.amountCentavos, paidAt, value.paymentKey);
    if (plan.kind === "replace") {
      if (!value.reason) throw new ActionError("INVALID_INPUT", "Give a reason of at least 3 characters.");
      try {
        for (const payment of active) {
          const { error } = await supabase.rpc("correct_remittance_payment", { p_payment_id: payment.id, p_reason: value.reason });
          if (error) throw error;
        }
        if (plan.targetCentavos > 0) await insertPayment(supabase, remittance.id, plan.targetCentavos, paidAt, value.paymentKey);
      } catch (error) {
        console.error("Lowering a payment stopped part way", error);
        revalidateRemittance(remittance.id);
        throw new ActionError("PARTIAL", "Some earlier payments were voided but the new amount wasn't saved. Save again to finish.");
      }
    }
    revalidateRemittance(remittance.id);
    return { updatedAt, receivedCentavos: value.targetPaymentCentavos };
  }, { notes: "notes (1,000 characters at most)", targetPaymentCentavos: "payment received", reason: "reason (at least 3 characters)" });
}
