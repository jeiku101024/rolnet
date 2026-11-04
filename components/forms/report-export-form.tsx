"use client";

import { useEffect, useRef, useState } from "react";
import { defaultPeriods, monthLabels, weekRangeText, type ReportKind } from "@/lib/reports/periods";
import type { UnitChoice } from "@/lib/reports/units-response";
import type { ReportPayload } from "@/lib/reports/report-payload";
import { Button } from "@/components/ui/button";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";

const kinds: { value: ReportKind; label: string }[] = [{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }];

type Scope = "all" | "unit";
/** The units loaded for one request key (kind and period), so a stale answer is never shown for a new period. */
type LoadedUnits = { key: string; units: UnitChoice[]; failed: boolean };

/**
 * Feature 014 (contracts/reports-http.md, research R4): Weekly, Monthly or Yearly .xlsx for all units or a single
 * unit. The server returns the report's data; the workbook is built here, in the browser, because building it on
 * the server would exceed the free hosting plan's CPU limit.
 */
export function ReportExportForm({ years }: { years: number[] }) {
  const defaults = defaultPeriods();
  const [kind, setKind] = useState<ReportKind>("monthly");
  const [date, setDate] = useState(defaults.date);
  const [month, setMonth] = useState(defaults.month.slice(5, 7));
  const [monthYear, setMonthYear] = useState(String(defaults.year));
  const [year, setYear] = useState(String(defaults.year));
  const [scope, setScope] = useState<Scope>("all");
  const [unitId, setUnitId] = useState("");
  const [loaded, setLoaded] = useState<LoadedUnits | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, status, submit } = useActionForm();

  // The period as a query string piece. It is empty until the period is complete.
  const period = kind === "weekly" ? (date ? `date=${date}` : "") : kind === "monthly" ? `month=${monthYear}-${month}` : `year=${year}`;
  const unitsKey = `${kind}&${period}`;

  useEffect(() => {
    if (scope !== "unit" || !period) return;
    const controller = new AbortController();
    fetch(`/api/reports/units?kind=${unitsKey}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() as Promise<{ units: UnitChoice[] }> : Promise.reject(new Error("units"))))
      .then(({ units }) => setLoaded({ key: unitsKey, units, failed: false }))
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setLoaded({ key: unitsKey, units: [], failed: true }); });
    return () => controller.abort();
  }, [scope, period, unitsKey]);

  const ready = loaded?.key === unitsKey ? loaded : null;
  const loadingUnits = scope === "unit" && Boolean(period) && !ready;
  // A chosen unit that is not eligible for the new period drops out of the choice.
  const chosenUnit = ready?.units.some((unit) => unit.id === unitId) ? unitId : "";
  const yearOptions = years.map((value) => <option key={value} value={value}>{value}</option>);

  return <FormPanel ref={formRef} className="space-y-5" onSubmit={submit(async () => {
    if (!period) return { ok: false, message: "Choose a date in the week to report." };
    if (scope === "unit" && !chosenUnit) return { ok: false, message: "Choose the unit to report on." };
    const query = new URLSearchParams(period);
    query.set("scope", scope);
    if (scope === "unit") query.set("unitId", chosenUnit);
    const response = await fetch(`/api/reports/${kind}?${query}`);
    if (!response.ok) {
      if (response.status === 401) return { ok: false, message: "Your session has ended. Sign in again, then download the report." };
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      return { ok: false, message: body?.error?.message ?? "The report could not be created. Try again." };
    }
    const payload = await response.json() as ReportPayload;
    // Loaded on first use so the Reports page itself stays light.
    const { buildPayloadWorkbook, xlsxContentType } = await import("@/lib/reports/report-payload");
    const bytes = await buildPayloadWorkbook(payload);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: xlsxContentType }));
    link.download = payload.fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return { ok: true, message: `Report downloaded: ${payload.fileName}.`, keepValues: true };
  })}>
    <div className="hidden space-y-2 sm:block">
      <p className="text-body-sm font-semibold text-ink">Report</p>
      <SegmentedToggle label="Report" value={kind} options={kinds} onChange={setKind} />
    </div>
    <div className="sm:hidden">
      <FormField label="Report"><Select value={kind} onChange={(event) => setKind(event.target.value as ReportKind)}>{kinds.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></FormField>
    </div>

    {kind === "weekly" ? <FormField label="Any date in the week" required hint={weekRangeText(date) || undefined}>
      <Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
    </FormField> : null}
    {kind === "monthly" ? <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Month" required><Select value={month} onChange={(event) => setMonth(event.target.value)}>{monthLabels.map((label, index) => <option key={label} value={String(index + 1).padStart(2, "0")}>{label}</option>)}</Select></FormField>
      <FormField label="Year" required><Select value={monthYear} onChange={(event) => setMonthYear(event.target.value)}>{yearOptions}</Select></FormField>
    </div> : null}
    {kind === "yearly" ? <FormField label="Year" required><Select value={year} onChange={(event) => setYear(event.target.value)}>{yearOptions}</Select></FormField> : null}

    <FormField label="Scope"><Select value={scope} onChange={(event) => setScope(event.target.value as Scope)}><option value="all">All units</option><option value="unit">Single unit</option></Select></FormField>
    {scope === "unit" ? <FormField label="Unit" required hint={ready?.failed ? "The units could not be loaded. Change the period or reload the page to try again." : undefined}>
      <Select value={chosenUnit} disabled={loadingUnits} onChange={(event) => setUnitId(event.target.value)}>
        <option value="">{loadingUnits ? "Loading units…" : ready?.units.length === 0 && !ready.failed ? "No units for this period" : "Choose a unit"}</option>
        {ready?.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
      </Select>
    </FormField> : null}
    <FormFooter pending={pending} status={status} label="Download .xlsx" pendingLabel="Creating report…" />
    {status?.kind === "error" && !pending ? <Button type="button" variant="outline" onClick={() => formRef.current?.requestSubmit()}>Retry</Button> : null}
  </FormPanel>;
}
