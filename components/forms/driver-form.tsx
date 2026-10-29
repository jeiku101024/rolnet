"use client";

import { createDriver } from "@/app/actions/drivers";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text } from "@/components/forms/form-values";

export function DriverForm() {
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const result = await createDriver({ fullName: text(data, "fullName"), driverKind: data.get("driverKind"), licenseNumber: text(data, "licenseNumber"), licenseExpiryDate: text(data, "licenseExpiryDate"), phone: text(data, "phone"), address: text(data, "address") });
    return result.ok ? { ok: true, message: "Driver saved." } : result;
  })}>
    <h2 className="text-lg font-semibold">Add driver</h2>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Full name" required><Input required name="fullName" maxLength={160} /></FormField><FormField label="Driver type"><Select name="driverKind" defaultValue="primary"><option value="primary">Primary</option><option value="backup">Backup / extrador</option></Select></FormField><FormField label="License number" required><Input required name="licenseNumber" maxLength={80} /></FormField><FormField label="License expiry" required><Input required name="licenseExpiryDate" type="date" /></FormField><FormField label="Phone" required><Input required name="phone" type="tel" minLength={3} maxLength={40} /></FormField><FormField label="Address"><Input name="address" maxLength={500} /></FormField></div>
    <FormFooter pending={pending} status={status} label="Save driver" />
  </FormPanel>;
}
