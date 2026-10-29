"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession, requirePermission } from "@/lib/auth/guards";
import { expenseSchema, receiptUploadSchema } from "@/lib/validation/expenses";

export async function createExpense(input: unknown) {
  await requireApprovedSession();
  const value = expenseSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("expenses").select().eq("idempotency_key", value.idempotencyKey).maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase.from("expenses").insert({ unit_id: value.unitId, category_id: value.categoryId, expense_date: value.expenseDate, amount_centavos: value.amountCentavos, notes: value.notes ?? null, idempotency_key: value.idempotencyKey }).select().single();
  if (error) throw new Error("Could not save expense. Check the unit, category, and amount.");
  revalidatePath("/expenses");
  revalidatePath(`/units/${value.unitId}`);
  return data;
}

export async function updateExpense(id: string, input: unknown) {
  await requireApprovedSession();
  const value = expenseSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("expenses").update({ unit_id: value.unitId, category_id: value.categoryId, expense_date: value.expenseDate, amount_centavos: value.amountCentavos, notes: value.notes ?? null }).eq("id", id).select().single();
  if (error) throw new Error("Could not update expense");
  revalidatePath("/expenses");
  return data;
}

export async function softDeleteExpense(id: string) {
  await requirePermission("manage_master_data");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("soft_delete_record", { p_table: "expenses", p_id: id });
  if (error || !data) throw new Error("Could not archive expense. Reload the page and try again.");
  revalidatePath("/expenses");
}

export async function prepareReceiptUpload(expenseId: string, filename: string, mimeType: string) {
  await requireApprovedSession();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error("Receipt must be JPEG, PNG, or WebP");
  const supabase = await createSupabaseServerClient();
  const { data: expense } = await supabase.from("expenses").select("id").eq("id", expenseId).is("deleted_at", null).maybeSingle();
  if (!expense) throw new Error("Expense was not found");
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpeg" : "webp";
  return { expenseId, objectPath: `receipts/${expenseId}/${randomUUID()}.${extension}` };
}

export async function finalizeReceiptUpload(input: unknown) {
  await requireApprovedSession();
  const value = receiptUploadSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("expenses").update({ receipt_object_path: value.objectPath, receipt_mime_type: value.mimeType, receipt_size_bytes: value.sizeBytes, receipt_sha256: value.sha256 }).eq("id", value.expenseId).is("deleted_at", null).select().single();
  if (error) throw new Error("Could not finalize receipt metadata");
  revalidatePath("/expenses");
  return data;
}
