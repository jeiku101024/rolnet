"use client";

import { useState } from "react";
import { createUnit } from "@/app/actions/units";
import { Button } from "@/components/ui/button";

export function UnitForm() {
  const [message, setMessage] = useState("");
  return <form className="space-y-4 rounded-lg border bg-white p-4" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await createUnit({ bodyNumber: form.get("bodyNumber"), plateNumber: form.get("plateNumber"), makeModel: form.get("makeModel"), status: form.get("status") }); setMessage("Unit saved."); event.currentTarget.reset(); } catch { setMessage("Could not save the unit. Check duplicate numbers and try again."); } }}>
    <h2 className="text-lg font-semibold">Add tricycle unit</h2>
    <label className="block text-sm font-medium">Body number<input required name="bodyNumber" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <label className="block text-sm font-medium">Plate number<input required name="plateNumber" className="mt-1 min-h-11 w-full rounded-md border p-3 uppercase" /></label>
    <label className="block text-sm font-medium">Make and model<input required name="makeModel" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
    <label className="block text-sm font-medium">Status<select name="status" defaultValue="active" className="mt-1 min-h-11 w-full rounded-md border p-3"><option value="active">Active</option><option value="in_repair">In repair</option><option value="retired">Retired</option></select></label>
    <Button type="submit">Save unit</Button>{message ? <p role="status" className="text-sm text-slate-600">{message}</p> : null}
  </form>;
}
