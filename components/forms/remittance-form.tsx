"use client";

import { useState } from "react";
import { addRemittancePayment, createRemittance } from "@/app/actions/remittances";
import { parseCentavos } from "@/lib/money/centavos";
import { FormPanel } from "@/components/ui/form-panel";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, ValidationSummary } from "@/components/ui/form-field";

type Assignment = { id: string; starts_on: string; ends_on: string | null; units: { body_number: string }[] | null; drivers: { full_name: string }[] | null };

export function RemittanceForm({ assignments }: { assignments: Assignment[] }) {
  const [message, setMessage] = useState("");
  const failed = message && !message.startsWith("Remittance");
  return <FormPanel className=" space-y-5" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const remittance = await createRemittance({ assignmentId: form.get("assignmentId"), serviceDate: form.get("serviceDate"), disposition: form.get("disposition"), notes: String(form.get("notes") || "") || undefined, idempotencyKey: crypto.randomUUID() }); const payment = String(form.get("payment") || "").trim(); if (payment) await addRemittancePayment({ remittanceId: remittance.id, amountCentavos: parseCentavos(payment), idempotencyKey: crypto.randomUUID() }); setMessage("Remittance saved."); event.currentTarget.reset(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save remittance."); } }}>
    <h2 className="text-lg font-semibold">Record daily remittance</h2>
    <FormField label="Assignment" required><Select required name="assignmentId"><option value="">Choose driver and unit</option>{assignments.map((assignment) => <option value={assignment.id} key={assignment.id}>{assignment.drivers?.[0]?.full_name ?? "Driver"} · Body {assignment.units?.[0]?.body_number ?? "Unit"}</option>)}</Select></FormField>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Service date" required><Input required name="serviceDate" type="date" /></FormField><FormField label="Unit disposition" required><Select required name="disposition" defaultValue="returned"><option value="returned">Returned to garage — ₱180</option><option value="overnight_overtime">Brought home / overtime — ₱300 total</option></Select></FormField><FormField label="Payment received (₱, optional)"><Input name="payment" inputMode="decimal" placeholder="0.00" /></FormField><FormField label="Notes"><Input name="notes" /></FormField></div>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit">Save remittance</Button><ValidationSummary message={failed ? message : undefined} />{message.startsWith("Remittance") ? <p role="status" className="text-body-sm text-ok">{message}</p> : null}</div>
  </FormPanel>;
}
