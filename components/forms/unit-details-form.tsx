"use client";

import { updateUnit } from "@/app/actions/units";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text } from "@/components/forms/form-values";

type Unit = { id: string; name: string; body_number: string; plate_number: string; make_model: string; updated_at: string };

/** Edits an Active unit's details (feature 005). Render it with key={unit.updated_at} so it reloads after a save. */
export function UnitDetailsForm({ unit }: { unit: Unit }) {
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const result = await updateUnit(unit.id, { name: text(data, "name"), bodyNumber: text(data, "bodyNumber"), plateNumber: text(data, "plateNumber")?.toUpperCase(), makeModel: text(data, "makeModel"), expectedUpdatedAt: unit.updated_at });
    return result.ok ? { ok: true, message: "Unit details saved.", keepValues: true } : result;
  })}>
    <h2 className="text-lg font-semibold">Edit details</h2>
    <FormField label="Unit name" required><Input required name="name" maxLength={40} defaultValue={unit.name} /></FormField>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Body number" required><Input required name="bodyNumber" maxLength={40} defaultValue={unit.body_number} /></FormField><FormField label="Plate number" required><Input required name="plateNumber" className="uppercase" maxLength={20} defaultValue={unit.plate_number} /></FormField></div>
    <FormField label="Motorcycle" required><Input required name="makeModel" maxLength={120} defaultValue={unit.make_model} /></FormField>
    <FormFooter pending={pending} status={status} label="Save details" />
  </FormPanel>;
}
