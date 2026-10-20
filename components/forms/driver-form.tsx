"use client";

import { useState } from "react";
import { createDriver } from "@/app/actions/drivers";
import { Button } from "@/components/ui/button";

export function DriverForm() {
  const [message, setMessage] = useState("");
  return <form className="space-y-4 rounded-lg border bg-white p-4" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await createDriver({ fullName: form.get("fullName"), driverKind: form.get("driverKind"), licenseNumber: form.get("licenseNumber"), licenseExpiryDate: form.get("licenseExpiryDate"), phone: form.get("phone"), address: form.get("address") }); setMessage("Driver saved."); event.currentTarget.reset(); } catch { setMessage("Could not save the driver. Check the license and required details."); } }}>
    <h2 className="text-lg font-semibold">Add driver</h2>
    <label className="block text-sm font-medium">Full name<input required name="fullName" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <label className="block text-sm font-medium">Driver type<select name="driverKind" defaultValue="primary" className="mt-1 min-h-11 w-full rounded-md border p-3"><option value="primary">Primary</option><option value="backup">Backup / extrador</option></select></label>
    <label className="block text-sm font-medium">License number<input required name="licenseNumber" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <label className="block text-sm font-medium">License expiry<input required name="licenseExpiryDate" type="date" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <label className="block text-sm font-medium">Phone<input required name="phone" type="tel" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <label className="block text-sm font-medium">Address<input name="address" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <Button type="submit">Save driver</Button>{message ? <p role="status" className="text-sm text-slate-600">{message}</p> : null}
  </form>;
}
