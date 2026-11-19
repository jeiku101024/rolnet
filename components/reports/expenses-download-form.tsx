"use client";

import { useState } from "react";
import { FormField, Select } from "@/components/ui/form-field";
import { DownloadCard } from "@/components/reports/download-card";
import { failureMessage, saveFile } from "@/components/reports/use-download";
import type { ExpensesMonthPayload } from "@/lib/expenses/month-data";
import { currentMonthDefaults, monthChoices } from "@/lib/reports/download-years";

/**
 * Feature 019 (contracts/expenses-month.md): the monthly Expenses download. Month and Year, defaulting to the current
 * month. The server returns the month's data; the workbook is built here, in the browser, loaded on first use.
 */
export function ExpensesDownloadForm({ years }: { years: number[] }) {
  const defaults = currentMonthDefaults();
  const [month, setMonth] = useState(defaults.month);
  const [year, setYear] = useState(defaults.year);
  const months = monthChoices(Number(year));
  const chosenMonth = months.some((choice) => choice.value === month) ? month : months.at(-1)!.value;

  return <DownloadCard onDownload={async () => {
    const response = await fetch(`/api/expenses/month?month=${year}-${chosenMonth}`);
    if (!response.ok) return { ok: false, message: await failureMessage(response) };
    const payload = await response.json() as ExpensesMonthPayload;
    const { buildExpensesWorkbook } = await import("@/lib/expenses/month-workbook");
    saveFile(await buildExpensesWorkbook(payload), payload.fileName);
    return { ok: true, message: `Report downloaded: ${payload.fileName}.`, keepValues: true };
  }}>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Month" required><Select value={chosenMonth} onChange={(event) => setMonth(event.target.value)}>{months.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</Select></FormField>
      <FormField label="Year" required><Select value={year} onChange={(event) => setYear(event.target.value)}>{years.map((value) => <option key={value} value={value}>{value}</option>)}</Select></FormField>
    </div>
  </DownloadCard>;
}
