"use client";

import { useState } from "react";
import { FormField, Select } from "@/components/ui/form-field";
import { DownloadCard } from "@/components/reports/download-card";
import { failureMessage, fileNameFrom, saveFile } from "@/components/reports/use-download";
import { currentMonthDefaults, monthChoices } from "@/lib/reports/download-years";

/**
 * Feature 019 (contracts/sinking-fund-standings.md): the owner's monthly standings download. Month and Year, defaulting
 * to the current month; the server builds the file (a few dozen rows) and this saves it.
 */
export function StandingsDownloadForm({ years }: { years: number[] }) {
  const defaults = currentMonthDefaults();
  const [month, setMonth] = useState(defaults.month);
  const [year, setYear] = useState(defaults.year);
  const months = monthChoices(Number(year));
  // Picking the current year after a later month in another year keeps the month inside the allowed range.
  const chosenMonth = months.some((choice) => choice.value === month) ? month : months.at(-1)!.value;

  return <DownloadCard onDownload={async () => {
    const key = `${year}-${chosenMonth}`;
    const response = await fetch(`/api/sinking-fund/standings?month=${key}`);
    if (!response.ok) return { ok: false, message: await failureMessage(response, "The file could not be created. Try again.") };
    const fileName = fileNameFrom(response, `rolnet-sinking-fund-standings-${key}.xlsx`);
    saveFile(new Uint8Array(await response.arrayBuffer()), fileName);
    return { ok: true, message: `Report downloaded: ${fileName}.`, keepValues: true };
  }}>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Month" required><Select value={chosenMonth} onChange={(event) => setMonth(event.target.value)}>{months.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</Select></FormField>
      <FormField label="Year" required><Select value={year} onChange={(event) => setYear(event.target.value)}>{years.map((value) => <option key={value} value={value}>{value}</option>)}</Select></FormField>
    </div>
  </DownloadCard>;
}
