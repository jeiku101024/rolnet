"use client";

import { useState } from "react";
import { installTire } from "@/app/actions/tires";
import { FormPanel } from "@/components/ui/form-panel";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, ValidationSummary } from "@/components/ui/form-field";

export function TireInstallationForm({ unitId }: { unitId: string }) {
  const [message, setMessage] = useState("");
  return <FormPanel className=" space-y-5" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await installTire({ unitId, position: form.get("position"), brand: form.get("brand"), installedOn: form.get("installedOn"), costCentavos: Number(form.get("costCentavos")), nextDueDate: String(form.get("nextDueDate") || "") || undefined, nextDueMileage: form.get("nextDueMileage") ? Number(form.get("nextDueMileage")) : undefined }); setMessage("Tire saved."); } catch { setMessage("Add a tire and at least one due value."); } }}>
    <h2 className="font-semibold">Install tire</h2>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Position"><Select name="position"><option value="front">Front</option><option value="rear_left">Rear-left</option><option value="rear_right">Rear-right</option></Select></FormField><FormField label="Brand" required><Input required name="brand" /></FormField><FormField label="Installed on" required><Input required name="installedOn" type="date" /></FormField><FormField label="Cost in centavos" required><Input required name="costCentavos" type="number" min="0" /></FormField><FormField label="Next due date"><Input name="nextDueDate" type="date" /></FormField><FormField label="Next due mileage"><Input name="nextDueMileage" type="number" min="0" /></FormField></div>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit">Save tire</Button><ValidationSummary message={message.startsWith("Add") ? message : undefined} />{message.startsWith("Tire") ? <p role="status" className="text-body-sm text-ok">{message}</p> : null}</div>
  </FormPanel>;
}
