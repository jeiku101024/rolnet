"use client";

import { useState } from "react";
import { defaultPeriods, monthLabels, weekCoverText, type ReportKind } from "@/lib/reports/periods";
import type { ReportUnit } from "@/lib/reports/report-data";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text } from "@/components/forms/form-values";

const kinds: { value: ReportKind; label: string }[] = [{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }];

/** Feature 009 (contracts/reports-http.md): Weekly, Monthly or Yearly .xlsx, for the fleet or one unit. */
export function ReportExportForm({ units, years }: { units: ReportUnit[]; years: number[] }) {
  const defaults = defaultPeriods();
  const [kind, setKind] = useState<ReportKind>("monthly");
  const [date, setDate] = useState(defaults.date);
  const [scope, setScope] = useState("fleet");
  const { pending, status, submit } = useActionForm();
  const yearOptions = years.map((year) => <option key={year} value={year}>{year}</option>);
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const query = new URLSearchParams({ scope });
    if (kind === "weekly") {
      if (!date) return { ok: false, message: "Choose a date in the week to report." };
      query.set("date", date);
    } else if (kind === "monthly") {
      query.set("month", `${text(data, "monthYear")}-${text(data, "month")}`);
    } else {
      query.set("year", text(data, "year") ?? "");
    }
    if (scope === "unit") {
      const unitId = text(data, "unitId");
      if (!unitId) return { ok: false, message: "Choose the unit to report on." };
      query.set("unitId", unitId);
    }
    const response = await fetch(`/api/reports/${kind}?${query}`);
    if (!response.ok) {
      if (response.status === 401) return { ok: false, message: "Your session has ended. Sign in again, then download the report." };
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      return { ok: false, message: body?.error?.message ?? "The report could not be created. Try again." };
    }
    const file = await response.blob();
    const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? `rolnet-${kind}.xlsx`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return { ok: true, message: `Report downloaded: ${name}.`, keepValues: true };
  })}>
    <div className="hidden space-y-2 sm:block">
      <p className="text-body-sm font-semibold text-ink">Report</p>
      <SegmentedToggle label="Report" value={kind} options={kinds} onChange={setKind} />
    </div>
    <div className="sm:hidden">
      <FormField label="Report"><Select value={kind} onChange={(event) => setKind(event.target.value as ReportKind)}>{kinds.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></FormField>
    </div>

    {kind === "weekly" ? <FormField label="Any date in the week" required hint={weekCoverText(date) || undefined}>
      <Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
    </FormField> : null}
    {kind === "monthly" ? <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Month" required><Select name="month" defaultValue={defaults.month.slice(5, 7)}>{monthLabels.map((label, index) => <option key={label} value={String(index + 1).padStart(2, "0")}>{label}</option>)}</Select></FormField>
      <FormField label="Year" required><Select name="monthYear" defaultValue={defaults.year}>{yearOptions}</Select></FormField>
    </div> : null}
    {kind === "yearly" ? <FormField label="Year" required><Select name="year" defaultValue={defaults.year}>{yearOptions}</Select></FormField> : null}

    <FormField label="Scope"><Select value={scope} onChange={(event) => setScope(event.target.value)}><option value="fleet">Whole fleet</option><option value="unit">One unit</option></Select></FormField>
    {scope === "unit" ? <FormField label="Unit" required>{units.length ? <Select name="unitId" defaultValue=""><option value="">Choose a unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</Select> : <p className="text-body-sm text-muted">No units yet.</p>}</FormField> : null}
    <FormFooter pending={pending} status={status} label="Download .xlsx" pendingLabel="Preparing…" />
  </FormPanel>;
}
