"use client";

import { useRouter } from "next/navigation";
import { addRemittancePayment, updateRemittanceNotes } from "@/app/actions/remittances";
import { correctRemittancePayment, reverseRemittance } from "@/app/actions/remittance-corrections";
import { parsePositiveCentavos } from "@/lib/money/centavos";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text } from "@/components/forms/form-values";

/** A later (partial or balance) payment for a saved remittance (FR-015). */
export function PaymentForm({ remittanceId, balanceText }: { remittanceId: string; balanceText: string }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data, key }) => {
    const amountCentavos = parsePositiveCentavos(text(data, "amount") ?? "");
    const result = await addRemittancePayment({ remittanceId, amountCentavos, notes: text(data, "notes"), idempotencyKey: key("payment") });
    if (!result.ok) return result;
    router.refresh();
    return { ok: true, message: "Payment saved." };
  })}>
    <h2 className="font-semibold">Add payment</h2>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Amount received (₱)" required hint={`Balance due: ${balanceText}. Paying more is kept as credit.`}><Input required name="amount" inputMode="decimal" placeholder="0.00" /></FormField><FormField label="Notes"><Input name="notes" maxLength={500} /></FormField></div>
    <FormFooter pending={pending} status={status} label="Save payment" />
  </FormPanel>;
}

/** Notes stay editable after saving; the date, disposition and due do not (FR-013a). */
export function RemittanceNotesForm({ remittanceId, notes, updatedAt }: { remittanceId: string; notes: string | null; updatedAt: string }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const result = await updateRemittanceNotes({ remittanceId, notes: String(data.get("notes") ?? "").trim(), expectedUpdatedAt: updatedAt });
    if (!result.ok) return result;
    router.refresh();
    return { ok: true, message: "Notes saved.", keepValues: true };
  })}>
    <h2 className="font-semibold">Notes</h2>
    <FormField label="Notes" hint="The date, disposition and amount due cannot be changed. The owner can reverse a wrong entry."><Textarea name="notes" maxLength={1000} defaultValue={notes ?? ""} /></FormField>
    <FormFooter pending={pending} status={status} label="Save notes" />
  </FormPanel>;
}

/** Owner-only: reverse a wrong remittance with a reason, then record a replacement. */
export function ReverseRemittanceForm({ remittanceId }: { remittanceId: string }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    if (!window.confirm("Reverse this remittance? It and its payments will no longer count. This is recorded in the audit history.")) return { ok: false, message: "Reversal cancelled." };
    const result = await reverseRemittance(remittanceId, text(data, "reason") ?? "");
    if (!result.ok) return result;
    router.push("/remittances");
    return { ok: true, message: "Remittance reversed. Record the correct entry from the Remittances page." };
  })}>
    <h2 className="font-semibold">Reverse this remittance</h2>
    <FormField label="Reason" required hint="For example: wrong date or wrong driver."><Input required name="reason" minLength={3} maxLength={500} /></FormField>
    <FormFooter pending={pending} status={status} label="Reverse remittance" pendingLabel="Reversing…" />
  </FormPanel>;
}

/** Owner-only: void a wrong payment with a reason; the correct amount can then be added. */
export function CorrectPaymentForm({ paymentId, remittanceId }: { paymentId: string; remittanceId: string }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  return <form className="grid gap-2" onSubmit={submit(async ({ data }) => {
    const result = await correctRemittancePayment(paymentId, remittanceId, text(data, "reason") ?? "");
    if (!result.ok) return result;
    router.refresh();
    return { ok: true, message: "Payment voided. Add the correct payment above." };
  })}>
    <FormField label="Reason to void"><Input required name="reason" minLength={3} maxLength={500} /></FormField>
    <FormFooter pending={pending} status={status} label="Void payment" pendingLabel="Voiding…" />
  </form>;
}
