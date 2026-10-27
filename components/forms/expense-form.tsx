"use client";

import { useState } from "react";
import { createExpense, finalizeReceiptUpload, prepareReceiptUpload } from "@/app/actions/expenses";
import { uploadReceipt } from "@/lib/uploads/receipts";
import { parseCentavos } from "@/lib/money/centavos";
import { FormPanel } from "@/components/ui/form-panel";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, ValidationSummary } from "@/components/ui/form-field";

type Category = { id: string; name: string };
type Unit = { id: string; body_number: string; plate_number: string };

export function ExpenseForm({ categories, units }: { categories: Category[]; units: Unit[] }) {
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const failed = message && !message.endsWith("saved.") && !message.includes("marked missing");
  return <FormPanel className=" space-y-5" onSubmit={async (event) => { event.preventDefault(); setMessage(""); const form = new FormData(event.currentTarget); try { const expense = await createExpense({ unitId: form.get("unitId"), categoryId: form.get("categoryId"), expenseDate: form.get("expenseDate"), amountCentavos: parseCentavos(String(form.get("amount"))), notes: String(form.get("notes") || "") || undefined, idempotencyKey: crypto.randomUUID() }); const file = form.get("receipt"); if (file instanceof File && file.size > 0) { setUploading(true); const prepared = await prepareReceiptUpload(expense.id, file.name, file.type); const upload = await uploadReceipt(file, prepared.objectPath); await finalizeReceiptUpload({ expenseId: expense.id, objectPath: prepared.objectPath, mimeType: upload.mimeType, sizeBytes: upload.sizeBytes, sha256: upload.sha256 }); setUploading(false); } setMessage(file instanceof File && file.size > 0 ? "Expense and receipt saved." : "Expense saved. Receipt is marked missing."); event.currentTarget.reset(); } catch (error) { setUploading(false); setMessage(error instanceof Error ? error.message : "Could not save expense."); } }}>
    <h2 className="text-lg font-semibold">Add expense</h2>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Unit" required><Select required name="unitId"><option value="">Choose a unit</option>{units.map((unit) => <option value={unit.id} key={unit.id}>Body {unit.body_number} · {unit.plate_number}</option>)}</Select></FormField><FormField label="Category" required><Select required name="categoryId"><option value="">Choose a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</Select></FormField><FormField label="Date" required><Input required name="expenseDate" type="date" /></FormField><FormField label="Amount (₱)" required><Input required name="amount" inputMode="decimal" placeholder="0.00" /></FormField></div>
    <FormField label="Notes"><Input name="notes" /></FormField><FormField label="Receipt photo (optional)" hint="Missing receipts stay visible in the ledger."><Input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" /></FormField>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={uploading}>{uploading ? "Uploading receipt…" : "Save expense"}</Button><ValidationSummary message={failed ? message : undefined} />{message && !failed ? <p role="status" className="text-body-sm text-ok">{message}</p> : null}</div>
  </FormPanel>;
}
