"use client";

import { useState } from "react";
import { fleetToday } from "@/lib/dates/fleet-date";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text } from "@/components/forms/form-values";
import { countUnitRows, reportHasActivity } from "@/lib/reports/monthly-csv";

type Unit = { id: string; body_number: string; plate_number: string };

export function ReportExportForm({ units }: { units: Unit[] }) {
  const [scope, setScope] = useState("fleet");
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const month = text(data, "month");
    if (!month) return { ok: false, message: "Choose the month to report." };
    const query = new URLSearchParams({ month, scope });
    const unitId = text(data, "unitId");
    if (scope === "unit") {
      if (!unitId) return { ok: false, message: "Choose the unit to report on." };
      query.set("unitId", unitId);
    }
    const response = await fetch(`/api/reports/monthly?${query}`, { headers: { accept: "text/csv" } });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (response.status === 401) return { ok: false, message: "Your session has ended. Sign in again, then download the report." };
      return { ok: false, message: body?.error?.message ?? "The report could not be created. Try again." };
    }
    // Save the response bytes as they are: response.text() would drop the UTF-8 BOM that lets
    // spreadsheet apps read the file as UTF-8 (contracts/http.md).
    const file = await response.blob();
    const csv = await file.text();
    const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? `rolnet-${month}.csv`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    if (!countUnitRows(csv)) return { ok: true, message: "There are no active units to report. The file has the headers and a zero total.", keepValues: true };
    if (!reportHasActivity(csv)) return { ok: true, message: `No remittances or expenses were recorded for ${month}. The file was downloaded with zero values.`, keepValues: true };
    return { ok: true, message: `Report downloaded: ${name}.`, keepValues: true };
  })}>
    <FormField label="Month" required><Input required name="month" type="month" defaultValue={fleetToday().slice(0, 7)} /></FormField>
    <FormField label="Scope"><Select name="scope" value={scope} onChange={(event) => setScope(event.target.value)}><option value="fleet">Whole fleet</option><option value="unit">One unit</option></Select></FormField>
    {scope === "unit" ? <FormField label="Unit" required>{units.length ? <Select name="unitId" defaultValue=""><option value="">Choose a unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>Body {unit.body_number} · {unit.plate_number}</option>)}</Select> : <p className="text-body-sm text-muted">No active units yet.</p>}</FormField> : null}
    <FormFooter pending={pending} status={status} label="Download CSV" pendingLabel="Preparing…" />
  </FormPanel>;
}
