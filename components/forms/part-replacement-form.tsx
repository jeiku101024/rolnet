"use client";

import { useState } from "react";
import { logPartReplacement } from "@/app/actions/parts";
import { FormPanel } from "@/components/ui/form-panel";
import { Button } from "@/components/ui/button";
import { FormField, Input, ValidationSummary } from "@/components/ui/form-field";

export function PartReplacementForm({ unitId }: { unitId: string }) {
  const [message, setMessage] = useState("");
  return <FormPanel className=" space-y-5" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await logPartReplacement({ unitId, partName: form.get("partName"), costCentavos: Number(form.get("costCentavos")), replacedOn: form.get("replacedOn"), nextDueDate: String(form.get("nextDueDate") || "") || undefined, nextDueMileage: form.get("nextDueMileage") ? Number(form.get("nextDueMileage")) : undefined }); setMessage("Part replacement saved."); } catch { setMessage("Add a part and at least one due value."); } }}>
    <h2 className="font-semibold">Log part replacement</h2>
    <FormField label="Part name" required><Input required name="partName" placeholder="e.g. brake pads" /></FormField>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Cost in centavos" required><Input required name="costCentavos" type="number" min="0" /></FormField><FormField label="Replaced on" required><Input required name="replacedOn" type="date" /></FormField><FormField label="Next due date"><Input name="nextDueDate" type="date" /></FormField><FormField label="Next due mileage"><Input name="nextDueMileage" type="number" min="0" /></FormField></div>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit">Save part</Button><ValidationSummary message={message.startsWith("Add") ? message : undefined} />{message.startsWith("Part") ? <p role="status" className="text-body-sm text-ok">{message}</p> : null}</div>
  </FormPanel>;
}
