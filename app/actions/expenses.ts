"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession, requirePermission } from "@/lib/auth/guards";
import { expenseSchema, expenseUpdateSchema, receiptUploadSchema } from "@/lib/validation/expenses";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";
import { receiptMimeTypes, receiptExtension } from "@/lib/uploads/rules";
import type { ExpenseCategory } from "@/lib/expenses/categories";

const labels = { unitId: "unit", category: "category", customCategory: "category name", expenseDate: "expense date", replacedDate: "date replaced", amountCentavos: "amount (more than ₱0.00)", notes: "notes" };
const staleMessage = "This expense was changed or deleted by someone else. Reload to see the latest.";

function revalidateExpense(...unitIds: (string | null | undefined)[]) {
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  for (const unitId of new Set(unitIds)) if (unitId) revalidatePath(`/units/${unitId}`);
}

/** The category columns for a validated input; the field that doesn't apply is null (data-model). */
function categoryColumns(value: { category: string; customCategory?: string; replacedDate?: string }) {
  const others = value.category === "others";
  return {
    category: value.category as ExpenseCategory,
    custom_category: others ? value.customCategory ?? null : null,
    replaced_date: others ? null : value.replacedDate ?? null,
  };
}

/** New and edited expenses must use a unit that isn't archived or deleted (data-model `unit_id`). */
async function requireActiveUnit(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, unitId: string) {
  const { data } = await supabase.from("units").select("id").eq("id", unitId).eq("archived", false).is("deleted_at", null).maybeSingle();
  if (!data) throw new ActionError("ARCHIVED_UNIT", "This unit is archived. Choose another unit.", { unitId: "This unit is archived. Choose another unit." });
}

export async function createExpense(input: unknown) {
  return run("Could not save the expense. Check the unit, category and amount.", async () => {
    await requireApprovedSession();
    const value = expenseSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase.from("expenses").select("id, updated_at").eq("idempotency_key", value.idempotencyKey).maybeSingle();
    if (existing) return { id: existing.id as string, updatedAt: existing.updated_at as string };
    await requireActiveUnit(supabase, value.unitId);
    const { data, error } = await supabase.from("expenses").insert({ unit_id: value.unitId, ...categoryColumns(value), expense_date: value.expenseDate, amount_centavos: value.amountCentavos, notes: value.notes || null, idempotency_key: value.idempotencyKey }).select("id, updated_at").single();
    if (error) throw error;
    revalidateExpense(value.unitId);
    return { id: data.id as string, updatedAt: data.updated_at as string };
  }, labels);
}

export async function updateExpense(id: string, input: unknown) {
  return run("Could not update the expense. Reload the page and try again.", async () => {
    await requireApprovedSession();
    const value = expenseUpdateSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data: before } = await supabase.from("expenses").select("unit_id").eq("id", id).is("deleted_at", null).maybeSingle();
    if (!before) throw new ActionError("STALE_RECORD", staleMessage);
    await requireActiveUnit(supabase, value.unitId);
    const { data, error } = await supabase.from("expenses").update({ unit_id: value.unitId, ...categoryColumns(value), expense_date: value.expenseDate, amount_centavos: value.amountCentavos, notes: value.notes || null }).eq("id", id).eq("updated_at", value.expectedUpdatedAt).is("deleted_at", null).select("id, updated_at").maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionError("STALE_RECORD", staleMessage);
    revalidateExpense(value.unitId, before.unit_id as string);
    return { id: data.id as string, updatedAt: data.updated_at as string };
  }, labels);
}

/** Owner-only delete (FR-028–FR-031): a soft delete with a stale check, audited by the database. */
export async function deleteExpense(id: string, expectedUpdatedAt: string) {
  return run("Could not delete the expense. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = z.object({ id: z.string().uuid(), expectedUpdatedAt: z.string().min(1) }).parse({ id, expectedUpdatedAt });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("soft_delete_record", { p_table: "expenses", p_id: value.id, p_expected_updated_at: value.expectedUpdatedAt });
    if (error) throw error;
    if (!data) throw new ActionError("STALE_RECORD", staleMessage);
    revalidateExpense((data as { unit_id?: string }).unit_id);
    return null;
  });
}

const prepareSchema = z.object({ expenseId: z.string().uuid(), mimeType: z.string() });

/** `mimeType` is the type of the compressed file the browser will upload (WebP after compression). */
export async function prepareReceiptUpload(expenseId: string, mimeType: string) {
  return run("Could not prepare the receipt upload. Try again.", async () => {
    await requireApprovedSession();
    const value = prepareSchema.parse({ expenseId, mimeType });
    if (!receiptMimeTypes.includes(value.mimeType)) throw new ActionError("UNSUPPORTED_FILE", "The receipt must be a JPG, PNG or WebP photo.");
    const supabase = await createSupabaseServerClient();
    const { data: expense } = await supabase.from("expenses").select("id").eq("id", value.expenseId).is("deleted_at", null).maybeSingle();
    if (!expense) throw new ActionError("NOT_FOUND", "This expense was not found. Reload the page and try again.");
    return { expenseId: value.expenseId, objectPath: `receipts/${value.expenseId}/${randomUUID()}.${receiptExtension(value.mimeType)}` };
  });
}

export async function finalizeReceiptUpload(input: unknown) {
  return run("Could not attach the receipt. Try attaching it again.", async () => {
    await requireApprovedSession();
    const value = receiptUploadSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("expenses").update({ receipt_object_path: value.objectPath, receipt_mime_type: value.mimeType, receipt_size_bytes: value.sizeBytes, receipt_sha256: value.sha256 }).eq("id", value.expenseId).is("deleted_at", null).select("id, unit_id").single();
    if (error) throw error;
    revalidateExpense(data.unit_id as string);
    return { id: data.id as string };
  }, { sizeBytes: "receipt size (500 KB at most)", objectPath: "receipt file" });
}

/** Short-lived (5 minute) signed link to an expense's private receipt (FR-017, T052). */
export async function getReceiptUrl(expenseId: string) {
  return run("Could not open the receipt. Try again.", async () => {
    await requireApprovedSession();
    const id = z.string().uuid().parse(expenseId);
    const supabase = await createSupabaseServerClient();
    const { data: expense } = await supabase.from("expenses").select("receipt_object_path").eq("id", id).is("deleted_at", null).maybeSingle();
    if (!expense?.receipt_object_path) throw new ActionError("NOT_FOUND", "This expense has no receipt attached.");
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(expense.receipt_object_path, 300);
    if (error || !data) throw new ActionError("NOT_FOUND", "The receipt file could not be found. Attach it again.");
    return { url: data.signedUrl };
  });
}
