"use client";

import { addRemittancePayment, createRemittance } from "@/app/actions/remittances";
import { parsePositiveCentavos } from "@/lib/money/centavos";
import { fleetToday } from "@/lib/dates/fleet-date";
import { one } from "@/lib/supabase/embed";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text } from "@/components/forms/form-values";

type Embed<T> = T | T[] | null;
export type RemittanceAssignment = { id: string; assignment_type: string; starts_on: string; ends_on: string | null; units: Embed<{ body_number: string }>; drivers: Embed<{ full_name: string }> };

export function assignmentLabel(assignment: RemittanceAssignment) {
  const driver = one(assignment.drivers)?.full_name ?? "Unknown driver";
  const unit = one(assignment.units)?.body_number ?? "unknown unit";
  const period = assignment.assignment_type === "backup" ? `backup on ${assignment.starts_on}` : `from ${assignment.starts_on}${assignment.ends_on ? ` to ${assignment.ends_on}` : ""}`;
  return `${driver} · Body ${unit} · ${period}`;
}

export function RemittanceForm({ assignments }: { assignments: RemittanceAssignment[] }) {
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data, key }) => {
    const paymentText = text(data, "payment");
    const paymentCentavos = paymentText ? parsePositiveCentavos(paymentText) : null;
    const remittance = await createRemittance({ assignmentId: text(data, "assignmentId"), serviceDate: text(data, "serviceDate"), disposition: data.get("disposition"), notes: text(data, "notes"), idempotencyKey: key("remittance") });
    if (!remittance.ok) return remittance;
    if (paymentCentavos !== null) {
      const payment = await addRemittancePayment({ remittanceId: remittance.data.id, amountCentavos: paymentCentavos, idempotencyKey: key("payment") });
      if (!payment.ok) return { ok: false, message: `The remittance was saved, but the payment was not: ${payment.message} Save again to retry the payment.` };
    }
    return { ok: true, message: paymentCentavos !== null ? "Remittance and payment saved." : "Remittance saved. No payment recorded yet." };
  })}>
    <h2 className="text-lg font-semibold">Record daily remittance</h2>
    <FormField label="Driver and unit" required hint="The driver who operated the unit on the service date."><Select required name="assignmentId"><option value="">Choose driver and unit</option>{assignments.map((assignment) => <option value={assignment.id} key={assignment.id}>{assignmentLabel(assignment)}</option>)}</Select></FormField>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Service date" required><Input required name="serviceDate" type="date" defaultValue={fleetToday()} /></FormField><FormField label="Unit disposition" required><Select required name="disposition" defaultValue="returned"><option value="returned">Returned to garage — ₱180</option><option value="overnight_overtime">Brought home / overtime — ₱300 total</option></Select></FormField><FormField label="Payment received (₱, optional)"><Input name="payment" inputMode="decimal" placeholder="0.00" /></FormField><FormField label="Notes"><Input name="notes" maxLength={1000} /></FormField></div>
    <FormFooter pending={pending} status={status} label="Save remittance" />
  </FormPanel>;
}
