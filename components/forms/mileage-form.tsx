"use client";

import { useRouter } from "next/navigation";
import { upsertMileageReading } from "@/app/actions/mileage";
import { fleetToday } from "@/lib/dates/fleet-date";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text, wholeNumber } from "@/components/forms/form-values";

/** Odometer reading for a date; saving the same date again corrects that reading (FR-008). */
export function MileageForm({ unitId, currentMileage }: { unitId: string; currentMileage: number }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const mileage = wholeNumber(data, "mileage", "mileage");
    if (mileage === undefined) return { ok: false, message: "Enter the odometer reading in kilometres." };
    const result = await upsertMileageReading({ unitId, readingDate: text(data, "readingDate"), mileage, notes: text(data, "notes") });
    if (!result.ok) return result;
    router.refresh();
    return { ok: true, message: result.data.updated ? "Mileage reading for that date corrected." : "Mileage saved." };
  })}>
    <h2 className="font-semibold">Record mileage</h2>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Reading date" required><Input required name="readingDate" type="date" defaultValue={fleetToday()} /></FormField><FormField label="Odometer (km)" required hint={`Current reading: ${currentMileage.toLocaleString()} km. Readings cannot go down over time.`}><Input required name="mileage" inputMode="numeric" /></FormField></div>
    <FormField label="Notes"><Input name="notes" maxLength={500} /></FormField>
    <FormFooter pending={pending} status={status} label="Save mileage" />
  </FormPanel>;
}
