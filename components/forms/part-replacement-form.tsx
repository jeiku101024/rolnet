"use client";

import { logPartReplacement } from "@/app/actions/parts";
import { parseCentavos } from "@/lib/money/centavos";
import { fleetToday } from "@/lib/dates/fleet-date";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text, wholeNumber } from "@/components/forms/form-values";

export function PartReplacementForm({ unitId, currentMileage }: { unitId: string; currentMileage?: number }) {
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const nextDueDate = text(data, "nextDueDate");
    const nextDueMileage = wholeNumber(data, "nextDueMileage", "next due mileage");
    if (!nextDueDate && nextDueMileage === undefined) return { ok: false, message: "Add a next due date or a next due mileage so the part shows up when it is due." };
    const result = await logPartReplacement({ unitId, partName: text(data, "partName"), costCentavos: parseCentavos(text(data, "cost") ?? ""), replacedOn: text(data, "replacedOn"), replacementMileage: wholeNumber(data, "replacementMileage", "replacement mileage"), nextDueDate, nextDueMileage, notes: text(data, "notes") });
    return result.ok ? { ok: true, message: "Part replacement saved." } : result;
  })}>
    <h2 className="font-semibold">Log part replacement</h2>
    <FormField label="Part name" required><Input required name="partName" placeholder="e.g. brake pads" maxLength={120} /></FormField>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Cost (₱)" required hint="Use 0 if the part was free."><Input required name="cost" inputMode="decimal" placeholder="0.00" /></FormField>
      <FormField label="Replaced on" required><Input required name="replacedOn" type="date" defaultValue={fleetToday()} /></FormField>
      <FormField label="Mileage at replacement (km)" hint={currentMileage !== undefined ? `Current reading: ${currentMileage.toLocaleString()} km` : undefined}><Input name="replacementMileage" inputMode="numeric" /></FormField>
      <FormField label="Next due date"><Input name="nextDueDate" type="date" /></FormField>
      <FormField label="Next due mileage (km)" hint="Add a due date, a due mileage, or both."><Input name="nextDueMileage" inputMode="numeric" /></FormField>
      <FormField label="Notes"><Input name="notes" maxLength={1000} /></FormField>
    </div>
    <FormFooter pending={pending} status={status} label="Save part" />
  </FormPanel>;
}
