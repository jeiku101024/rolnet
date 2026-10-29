"use client";

import { updateDriver } from "@/app/actions/drivers";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text } from "@/components/forms/form-values";

type Driver = { id: string; full_name: string; driver_kind: string; license_number: string; license_expiry_date: string; phone: string; address: string | null; updated_at: string };

/** Edits an Active driver's details (feature 005). Render it with key={driver.updated_at} so it reloads after a save. */
export function DriverDetailsForm({ driver }: { driver: Driver }) {
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const result = await updateDriver(driver.id, { fullName: text(data, "fullName"), driverKind: data.get("driverKind"), licenseNumber: text(data, "licenseNumber"), licenseExpiryDate: text(data, "licenseExpiryDate"), phone: text(data, "phone"), address: text(data, "address"), expectedUpdatedAt: driver.updated_at });
    return result.ok ? { ok: true, message: "Driver details saved.", keepValues: true } : result;
  })}>
    <h2 className="text-lg font-semibold">Edit details</h2>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Full name" required><Input required name="fullName" maxLength={160} defaultValue={driver.full_name} /></FormField><FormField label="Driver type"><Select name="driverKind" defaultValue={driver.driver_kind}><option value="primary">Primary</option><option value="backup">Backup / extrador</option></Select></FormField><FormField label="License number" required><Input required name="licenseNumber" maxLength={80} defaultValue={driver.license_number} /></FormField><FormField label="License expiry" required hint="If a license document is uploaded, renew it on the Documents page to change this date."><Input required name="licenseExpiryDate" type="date" defaultValue={driver.license_expiry_date} /></FormField><FormField label="Phone" required><Input required name="phone" type="tel" inputMode="tel" minLength={3} maxLength={40} defaultValue={driver.phone} /></FormField><FormField label="Address"><Input name="address" maxLength={500} defaultValue={driver.address ?? ""} /></FormField></div>
    <FormFooter pending={pending} status={status} label="Save details" />
  </FormPanel>;
}
