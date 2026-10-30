"use client";

import { createUnit } from "@/app/actions/units";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text } from "@/components/forms/form-values";

export function UnitForm() {
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const result = await createUnit({ name: text(data, "name"), bodyNumber: text(data, "bodyNumber"), plateNumber: text(data, "plateNumber")?.toUpperCase(), makeModel: text(data, "makeModel"), status: data.get("status") });
    return result.ok ? { ok: true, message: "Unit saved." } : result;
  })}>
    <h2 className="text-lg font-semibold">Add tricycle unit</h2>
    <FormField label="Unit name" required><Input required name="name" maxLength={40} placeholder="e.g. ROLNET-1" /></FormField>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Body number" required><Input required name="bodyNumber" maxLength={40} /></FormField><FormField label="Plate number" required><Input required name="plateNumber" className="uppercase" maxLength={20} /></FormField></div>
    <FormField label="Motorcycle" required><Input required name="makeModel" maxLength={120} placeholder="e.g. Yamaha YTX" /></FormField>
    <FormField label="Status"><Select name="status" defaultValue="active"><option value="active">Active</option><option value="in_repair">In repair</option><option value="retired">Retired</option></Select></FormField>
    <FormFooter pending={pending} status={status} label="Save unit" />
  </FormPanel>;
}
