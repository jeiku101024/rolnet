"use client";

import { useState } from "react";
import { createDriver } from "@/app/actions/drivers";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, ValidationSummary } from "@/components/ui/form-field";

export function DriverForm() {
  const [message, setMessage] = useState("");
  return <form className="data-region space-y-5" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await createDriver({ fullName: form.get("fullName"), driverKind: form.get("driverKind"), licenseNumber: form.get("licenseNumber"), licenseExpiryDate: form.get("licenseExpiryDate"), phone: form.get("phone"), address: form.get("address") }); setMessage("Driver saved."); event.currentTarget.reset(); } catch { setMessage("Could not save the driver. Check the license and required details."); } }}>
    <h2 className="text-lg font-semibold">Add driver</h2>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Full name" required><Input required name="fullName" /></FormField><FormField label="Driver type"><Select name="driverKind" defaultValue="primary"><option value="primary">Primary</option><option value="backup">Backup / extrador</option></Select></FormField><FormField label="License number" required><Input required name="licenseNumber" /></FormField><FormField label="License expiry" required><Input required name="licenseExpiryDate" type="date" /></FormField><FormField label="Phone" required><Input required name="phone" type="tel" /></FormField><FormField label="Address"><Input name="address" /></FormField></div>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit">Save driver</Button><ValidationSummary message={message.startsWith("Could") ? message : undefined} />{message && !message.startsWith("Could") ? <p role="status" className="text-body-sm text-ok">{message}</p> : null}</div>
  </form>;
}
