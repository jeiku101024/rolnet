"use client";

import { useState } from "react";
import { createExpense, finalizeReceiptUpload, prepareReceiptUpload } from "@/app/actions/expenses";
import { uploadReceipt } from "@/lib/uploads/receipts";
import { parseCentavos } from "@/lib/money/centavos";
import { Button } from "@/components/ui/button";

type Category = { id: string; name: string };
type Unit = { id: string; body_number: string; plate_number: string };

export function ExpenseForm({ categories, units }: { categories: Category[]; units: Unit[] }) {
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  return <form className="space-y-4 rounded-lg border bg-white p-4" onSubmit={async (event) => { event.preventDefault(); setMessage(""); const form = new FormData(event.currentTarget); try { const expense = await createExpense({ unitId: form.get("unitId"), categoryId: form.get("categoryId"), expenseDate: form.get("expenseDate"), amountCentavos: parseCentavos(String(form.get("amount"))), notes: String(form.get("notes") || "") || undefined, idempotencyKey: crypto.randomUUID() }); const file = form.get("receipt"); if (file instanceof File && file.size > 0) { setUploading(true); const prepared = await prepareReceiptUpload(expense.id, file.name, file.type); const upload = await uploadReceipt(file, prepared.objectPath); await finalizeReceiptUpload({ expenseId: expense.id, objectPath: prepared.objectPath, mimeType: upload.mimeType, sizeBytes: upload.sizeBytes, sha256: upload.sha256 }); setUploading(false); } setMessage(file instanceof File && file.size > 0 ? "Expense and receipt saved." : "Expense saved. Receipt is marked missing."); event.currentTarget.reset(); } catch (error) { setUploading(false); setMessage(error instanceof Error ? error.message : "Could not save expense."); } }}>
    <h2 className="text-lg font-semibold">Add expense</h2>
    <label className="block text-sm font-medium">Unit<select required name="unitId" className="mt-1 min-h-11 w-full rounded-md border p-3"><option value="">Choose a unit</option>{units.map((unit) => <option value={unit.id} key={unit.id}>Body {unit.body_number} · {unit.plate_number}</option>)}</select></label>
    <label className="block text-sm font-medium">Category<select required name="categoryId" className="mt-1 min-h-11 w-full rounded-md border p-3"><option value="">Choose a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
    <label className="block text-sm font-medium">Date<input required name="expenseDate" type="date" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <label className="block text-sm font-medium">Amount (₱)<input required name="amount" inputMode="decimal" placeholder="0.00" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <label className="block text-sm font-medium">Notes<input name="notes" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <label className="block text-sm font-medium">Receipt photo (optional)<input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block min-h-11 w-full rounded-md border p-3 text-sm" /></label>
    <Button type="submit" disabled={uploading}>{uploading ? "Compressing receipt…" : "Save expense"}</Button>{message ? <p role="status" className="text-sm text-slate-600">{message}</p> : null}
  </form>;
}
