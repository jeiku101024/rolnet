"use client";

import { useRouter } from "next/navigation";
import { installTire } from "@/app/actions/tires";
import { parseCentavos } from "@/lib/money/centavos";
import { fleetToday } from "@/lib/dates/fleet-date";
import { tirePositionLabels, tirePositions } from "@/lib/validation/maintenance";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text, wholeNumber } from "@/components/forms/form-values";

export function TireInstallationForm({ unitId, currentMileage }: { unitId: string; currentMileage?: number }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const nextDueDate = text(data, "nextDueDate");
    const nextDueMileage = wholeNumber(data, "nextDueMileage", "next due mileage");
    if (!nextDueDate && nextDueMileage === undefined) return { ok: false, message: "Add a next due date or a next due mileage so the tire shows up when it is due." };
    const position = String(data.get("position"));
    const result = await installTire({ unitId, position, brand: text(data, "brand"), installedOn: text(data, "installedOn"), installedMileage: wholeNumber(data, "installedMileage", "installed mileage"), costCentavos: parseCentavos(text(data, "cost") ?? ""), nextDueDate, nextDueMileage });
    if (!result.ok) return result;
    router.refresh();
    const label = tirePositionLabels[position] ?? position;
    return { ok: true, message: result.data.replaced ? `${label} tire replaced. The previous tire is kept in the history.` : `${label} tire saved.` };
  })}>
    <h2 className="font-semibold">Install tire</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Position" required hint="Installing at a position that has a tire replaces it."><Select required name="position">{tirePositions.map((position) => <option key={position} value={position}>{tirePositionLabels[position]}</option>)}</Select></FormField>
      <FormField label="Brand" required><Input required name="brand" maxLength={80} /></FormField>
      <FormField label="Installed on" required><Input required name="installedOn" type="date" defaultValue={fleetToday()} /></FormField>
      <FormField label="Mileage at installation (km)" hint={currentMileage !== undefined ? `Current reading: ${currentMileage.toLocaleString()} km` : undefined}><Input name="installedMileage" inputMode="numeric" /></FormField>
      <FormField label="Cost (₱)" required><Input required name="cost" inputMode="decimal" placeholder="0.00" /></FormField>
      <FormField label="Next due date"><Input name="nextDueDate" type="date" /></FormField>
      <FormField label="Next due mileage (km)" hint="Add a due date, a due mileage, or both."><Input name="nextDueMileage" inputMode="numeric" /></FormField>
    </div>
    <FormFooter pending={pending} status={status} label="Save tire" />
  </FormPanel>;
}
