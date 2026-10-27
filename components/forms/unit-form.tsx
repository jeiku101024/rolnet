"use client";

import { useState } from "react";
import { createUnit } from "@/app/actions/units";
import { FormPanel } from "@/components/ui/form-panel";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, ValidationSummary } from "@/components/ui/form-field";

export function UnitForm() {
  const [message, setMessage] = useState("");
  return <FormPanel className=" space-y-5" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await createUnit({ bodyNumber: form.get("bodyNumber"), plateNumber: form.get("plateNumber"), makeModel: form.get("makeModel"), status: form.get("status") }); setMessage("Unit saved."); event.currentTarget.reset(); } catch { setMessage("Could not save the unit. Check duplicate numbers and try again."); } }}>
    <h2 className="text-lg font-semibold">Add tricycle unit</h2>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Body number" required><Input required name="bodyNumber" /></FormField><FormField label="Plate number" required><Input required name="plateNumber" className="uppercase" /></FormField></div>
    <FormField label="Make and model" required><Input required name="makeModel" /></FormField>
    <FormField label="Status"><Select name="status" defaultValue="active"><option value="active">Active</option><option value="in_repair">In repair</option><option value="retired">Retired</option></Select></FormField>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit">Save unit</Button><ValidationSummary message={message.startsWith("Could") ? message : undefined} />{message && !message.startsWith("Could") ? <p role="status" className="text-body-sm text-ok">{message}</p> : null}</div>
  </FormPanel>;
}
