"use client";

import { useState } from "react";
import { addRemittancePayment, createRemittance } from "@/app/actions/remittances";
import { parseCentavos } from "@/lib/money/centavos";
import { Button } from "@/components/ui/button";

type Assignment = { id: string; starts_on: string; ends_on: string | null; units: { body_number: string }[] | null; drivers: { full_name: string }[] | null };

export function RemittanceForm({ assignments }: { assignments: Assignment[] }) {
  const [message, setMessage] = useState("");
  return <form className="space-y-4 rounded-lg border bg-white p-4" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const remittance = await createRemittance({ assignmentId: form.get("assignmentId"), serviceDate: form.get("serviceDate"), disposition: form.get("disposition"), notes: String(form.get("notes") || "") || undefined, idempotencyKey: crypto.randomUUID() }); const payment = String(form.get("payment") || "").trim(); if (payment) await addRemittancePayment({ remittanceId: remittance.id, amountCentavos: parseCentavos(payment), idempotencyKey: crypto.randomUUID() }); setMessage("Remittance saved."); event.currentTarget.reset(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save remittance."); } }}>
    <h2 className="text-lg font-semibold">Record daily remittance</h2>
    <label className="block text-sm font-medium">Assignment<select required name="assignmentId" className="mt-1 min-h-11 w-full rounded-md border p-3"><option value="">Choose driver and unit</option>{assignments.map((assignment) => <option value={assignment.id} key={assignment.id}>{assignment.drivers?.[0]?.full_name ?? "Driver"} · Body {assignment.units?.[0]?.body_number ?? "Unit"}</option>)}</select></label>
    <label className="block text-sm font-medium">Service date<input required name="serviceDate" type="date" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <label className="block text-sm font-medium">Unit disposition<select required name="disposition" defaultValue="returned" className="mt-1 min-h-11 w-full rounded-md border p-3"><option value="returned">Returned to garage — ₱180</option><option value="overnight_overtime">Brought home / overtime — ₱300 total</option></select></label>
    <label className="block text-sm font-medium">Payment received (₱, optional)<input name="payment" inputMode="decimal" placeholder="0.00" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <label className="block text-sm font-medium">Notes<input name="notes" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <Button type="submit">Save remittance</Button>{message ? <p role="status" className="text-sm text-slate-600">{message}</p> : null}
  </form>;
}
