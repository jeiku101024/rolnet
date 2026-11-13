"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession } from "@/lib/auth/guards";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";
import { demoMode } from "@/lib/demo/mode";
import { loanDueDate } from "@/lib/sinking-fund/rules";
import { sfMessages } from "@/lib/sinking-fund/messages";
import { archiveSchema, changeInterestSchema, depositSchema, distributeSchema, loanSchema, loanWithdrawalSchema, participantSchema, paymentSchema, renameSchema, savingsWithdrawalSchema, settingsSchema, voidSchema } from "@/lib/validation/sinking-fund";

/**
 * Sinking fund Server Actions (feature 015, contracts/server-actions.md). Each is thin: authorize, parse,
 * call exactly one SQL function (one transaction, rules enforced there), revalidate. Owner-only actions
 * check the role here and again inside the database function.
 */

const labels = {
  participantId: "participant", name: "name", date: "date", amountCentavos: "amount (more than ₱0.00)", interestPartCentavos: "interest part",
  loanId: "loan", reason: "reason", notes: "notes",
};

function guardDemo() {
  if (demoMode) throw new ActionError("DEMO_MODE", sfMessages.demoMode);
}

/** Any approved user (owner or staff). */
async function requireUser() {
  guardDemo();
  return requireApprovedSession();
}

/** The owner only (spec section 16). Staff get a plain message instead of a redirect. */
async function requireOwner() {
  const profile = await requireUser();
  if (profile.role !== "owner") throw new ActionError("FORBIDDEN", sfMessages.ownerOnly);
  return profile;
}

const revalidate = () => revalidatePath("/sinking-fund");

export async function addParticipant(input: unknown) {
  return run("Could not add the participant. Check the name and try again.", async () => {
    await requireUser();
    const value = participantSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("sf_add_participant", { p_name: value.name, p_driver_id: value.driverId ?? null, p_notes: value.notes ?? null });
    if (error) throw error;
    revalidate();
    return { id: data as string };
  }, labels);
}

export async function renameParticipant(input: unknown) {
  return run("Could not change the name. Reload the page and try again.", async () => {
    await requireUser();
    const value = renameSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("sf_rename_participant", { p_id: value.id, p_name: value.name, p_expected_updated_at: value.expectedUpdatedAt });
    if (error) throw error;
    revalidate();
    return null;
  }, labels);
}

export async function archiveParticipant(input: unknown) {
  return run("Could not archive the participant. Reload the page and try again.", async () => {
    await requireOwner();
    const value = archiveSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("sf_archive_participant", { p_id: value.id, p_expected_updated_at: value.expectedUpdatedAt });
    if (error) throw error;
    revalidate();
    return null;
  });
}

export async function recordDeposit(input: unknown) {
  return run("Could not record the deposit. Check the amount and date.", async () => {
    await requireUser();
    const value = depositSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("sf_record_deposit", { p_participant: value.participantId, p_date: value.date, p_amount: value.amountCentavos, p_notes: value.notes ?? null, p_key: value.idempotencyKey });
    if (error) throw error;
    revalidate();
    return { id: data as string };
  }, labels);
}

export async function recordLoan(input: unknown) {
  return run("Could not record the loan. Check the amount and date.", async () => {
    await requireUser();
    const value = loanSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("sf_record_loan", { p_participant: value.participantId, p_date: value.date, p_amount: value.amountCentavos, p_notes: value.notes ?? null, p_key: value.idempotencyKey });
    if (error) throw error;
    revalidate();
    const interest = (value.amountCentavos * 500) / 10000;
    return { id: data as string, amountDueCentavos: value.amountCentavos + interest, dueDate: loanDueDate(value.date) };
  }, labels);
}

export async function recordPayment(input: unknown) {
  return run("Could not record the payment. Check the loan, amount and date.", async () => {
    const profile = await requireUser();
    const value = paymentSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    // Only the owner sets the interest part; the database also ignores it for everyone else.
    const interestPart = profile.role === "owner" ? value.interestPartCentavos ?? null : null;
    const { data, error } = await supabase.rpc("sf_record_payment", { p_loan: value.loanId, p_date: value.date, p_amount: value.amountCentavos, p_interest_part: interestPart, p_notes: value.notes ?? null, p_key: value.idempotencyKey });
    if (error) throw error;
    const { data: loan } = await supabase.from("sf_loans_v").select("balance_centavos").eq("id", value.loanId).maybeSingle();
    revalidate();
    return { id: data as string, balanceAfterCentavos: loan?.balance_centavos ?? 0 };
  }, labels);
}

export async function recordSavingsWithdrawal(input: unknown) {
  return run("Could not record the savings withdrawal. Check the amount and date.", async () => {
    await requireOwner();
    const value = savingsWithdrawalSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("sf_record_savings_withdrawal", { p_participant: value.participantId, p_date: value.date, p_amount: value.amountCentavos, p_notes: value.notes ?? null, p_key: value.idempotencyKey });
    if (error) throw error;
    revalidate();
    return { id: data as string };
  }, labels);
}

export async function markLoanWithdrawal(input: unknown) {
  return run("Could not close the loan. Reload the page and try again.", async () => {
    await requireOwner();
    const value = loanWithdrawalSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("sf_mark_loan_withdrawal", { p_loan: value.loanId, p_expected_balance_centavos: value.expectedBalanceCentavos });
    if (error) throw error;
    revalidate();
    return null;
  });
}

export async function changeInterestPart(input: unknown) {
  return run("Could not change the interest part. Reload the page and try again.", async () => {
    await requireOwner();
    const value = changeInterestSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("sf_change_interest_part", { p_payment: value.paymentId, p_interest_part: value.interestPartCentavos, p_expected_updated_at: value.expectedUpdatedAt });
    if (error) throw error;
    revalidate();
    return null;
  }, labels);
}

export async function distributeInterest(input: unknown) {
  return run("Could not distribute the interest. Reload the page and try again.", async () => {
    await requireOwner();
    const value = distributeSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("sf_distribute_interest", { p_date: value.date, p_participants: value.participantIds, p_notes: value.notes ?? null, p_key: value.idempotencyKey });
    if (error) throw error;
    const { data: row } = await supabase.from("sf_distributions").select("total_distributed_centavos, participant_count").eq("id", data as string).maybeSingle();
    revalidate();
    return { id: data as string, totalCentavos: row?.total_distributed_centavos ?? 0, participants: row?.participant_count ?? value.participantIds.length };
  }, labels);
}

export async function voidTransaction(input: unknown) {
  return run("Could not void the transaction. Reload the page and try again.", async () => {
    await requireOwner();
    const value = voidSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("sf_void_transaction", { p_id: value.id, p_reason: value.reason, p_expected_updated_at: value.expectedUpdatedAt });
    if (error) throw error;
    revalidate();
    return null;
  }, labels);
}

export async function voidDistribution(input: unknown) {
  return run("Could not void the distribution. Reload the page and try again.", async () => {
    await requireOwner();
    const value = voidSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("sf_void_distribution", { p_id: value.id, p_reason: value.reason, p_expected_updated_at: value.expectedUpdatedAt });
    if (error) throw error;
    revalidate();
    return null;
  }, labels);
}

export async function saveFundSettings(input: unknown) {
  return run("Could not save the settings. Try again.", async () => {
    await requireOwner();
    const value = settingsSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("sf_set_default_prefill", { p_value: value.prefill });
    if (error) throw error;
    revalidate();
    return null;
  });
}

/** The allowed interest part for a payment (owner form and Change interest part), from the database rules. */
export async function getAllowedInterest(loanId: string, amountCentavos: number, excludePaymentId: string | null) {
  return run("Could not read the allowed interest part.", async () => {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("sf_allowed_interest_range", { p_loan: loanId, p_amount: amountCentavos, p_exclude_payment: excludePaymentId });
    if (error) throw error;
    const row = (data ?? [])[0];
    return { min: row?.min_part ?? 0, max: row?.max_part ?? 0 };
  });
}
