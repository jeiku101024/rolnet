"use client";

import { useRouter } from "next/navigation";
import { createExpense, finalizeReceiptUpload, prepareReceiptUpload, updateExpense } from "@/app/actions/expenses";
import { prepareReceiptFile, removeReceiptObject, uploadReceipt } from "@/lib/uploads/receipts";
import { receiptFileProblem } from "@/lib/uploads/rules";
import { parsePositiveCentavos } from "@/lib/money/centavos";
import { fleetToday } from "@/lib/dates/fleet-date";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { file, text } from "@/components/forms/form-values";

type Category = { id: string; name: string };
type Unit = { id: string; body_number: string; plate_number: string };
export type EditableExpense = { id: string; unit_id: string; category_id: string; expense_date: string; amount_centavos: number; notes: string | null; updated_at: string; receipt_object_path: string | null };

type PreparedReceipt = Awaited<ReturnType<typeof prepareReceiptFile>>;

/** Uploads a compressed receipt for a saved expense; removes the object if its metadata cannot be saved. */
async function attachReceipt(expenseId: string, receipt: PreparedReceipt) {
  const prepared = await prepareReceiptUpload(expenseId, receipt.mimeType);
  if (!prepared.ok) return prepared;
  await uploadReceipt(receipt.file, prepared.data.objectPath, receipt.mimeType);
  const finalized = await finalizeReceiptUpload({ expenseId, objectPath: prepared.data.objectPath, mimeType: receipt.mimeType, sizeBytes: receipt.sizeBytes, sha256: receipt.sha256 });
  if (!finalized.ok) await removeReceiptObject(prepared.data.objectPath);
  return finalized;
}

function centavosToInput(centavos: number) {
  return (centavos / 100).toFixed(2);
}

export function ExpenseForm({ categories, units, expense }: { categories: Category[]; units: Unit[]; expense?: EditableExpense }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  const editing = Boolean(expense);
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data, key }) => {
    // Check and compress the receipt before saving anything, so an unusable file never leaves a
    // half-saved expense behind (T134).
    const receiptFile = file(data, "receipt");
    let receipt: PreparedReceipt | null = null;
    if (receiptFile) {
      const problem = receiptFileProblem(receiptFile);
      if (problem) return { ok: false, message: problem };
      receipt = await prepareReceiptFile(receiptFile);
    }
    const amountCentavos = parsePositiveCentavos(text(data, "amount") ?? "");
    const fields = { unitId: text(data, "unitId"), categoryId: text(data, "categoryId"), expenseDate: text(data, "expenseDate"), amountCentavos, notes: text(data, "notes") };
    const saved = expense
      ? await updateExpense(expense.id, { ...fields, expectedUpdatedAt: expense.updated_at })
      : await createExpense({ ...fields, idempotencyKey: key("expense") });
    if (!saved.ok) return saved;
    if (!receipt) {
      if (expense) { router.push("/expenses"); router.refresh(); return { ok: true, message: "Expense updated." }; }
      return { ok: true, message: "Expense saved. Receipt is marked missing; you can attach it later from Edit." };
    }
    const attached = await attachReceipt(saved.data.id, receipt);
    router.refresh();
    if (!attached.ok) return { ok: false, message: `The expense was saved, but the receipt was not attached: ${attached.message} Save again to retry the receipt.` };
    if (expense) { router.push("/expenses"); return { ok: true, message: "Expense and receipt updated." }; }
    return { ok: true, message: "Expense and receipt saved." };
  })}>
    <h2 className="text-lg font-semibold">{editing ? "Edit expense" : "Add expense"}</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Unit" required><Select required name="unitId" defaultValue={expense?.unit_id ?? ""}><option value="">Choose a unit</option>{units.map((unit) => <option value={unit.id} key={unit.id}>Body {unit.body_number} · {unit.plate_number}</option>)}</Select></FormField>
      <FormField label="Category" required><Select required name="categoryId" defaultValue={expense?.category_id ?? ""}><option value="">Choose a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</Select></FormField>
      <FormField label="Date" required><Input required name="expenseDate" type="date" defaultValue={expense?.expense_date ?? fleetToday()} /></FormField>
      <FormField label="Amount (₱)" required hint="More than ₱0.00, for example 250 or 250.50."><Input required name="amount" inputMode="decimal" placeholder="0.00" defaultValue={expense ? centavosToInput(expense.amount_centavos) : undefined} /></FormField>
    </div>
    <FormField label="Notes"><Input name="notes" maxLength={1000} defaultValue={expense?.notes ?? undefined} /></FormField>
    <FormField label={expense?.receipt_object_path ? "Replace receipt photo (optional)" : "Receipt photo (optional)"} hint="JPG, PNG or WebP. Photos are compressed before upload. Missing receipts stay visible in the ledger."><Input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" /></FormField>
    <FormFooter pending={pending} status={status} label={editing ? "Save changes" : "Save expense"} />
  </FormPanel>;
}
