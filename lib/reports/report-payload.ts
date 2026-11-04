import { buildReportSheets, reportFileName, type BuildInput } from "@/lib/reports/build-report";
import type { ReportKind } from "@/lib/reports/periods";
import type { ReportRemittance, UnitDailyData, UnitYearData } from "@/lib/reports/report-layout";
import { workbookBytes } from "@/lib/reports/xlsx";

// Feature 014 (research R4): the free Workers plan cannot generate a 100-unit workbook inside its CPU limit, so
// the report route returns this JSON and the browser builds the .xlsx from it with the same code the tests run.
// All amounts are integer centavos; the server sends no computed totals.

export interface ReportPayload {
  kind: ReportKind;
  /** YYYY-MM for monthly, the Monday for weekly, YYYY for yearly. */
  key: string;
  scope: "all" | "unit";
  fileName: string;
  /** The units to report, in tab order. */
  units: { id: string; name: string }[];
  /** Weekly and monthly: per unit, its remittances and its expenses by date. Units with no records are absent. */
  daily?: Record<string, { remittances: ReportRemittance[]; expenses: [string, number][] }>;
  /** Yearly: per unit, twelve months and the year's expenses. */
  yearly?: Record<string, UnitYearData>;
}

export interface PayloadSource {
  kind: ReportKind;
  key: string;
  scope: "all" | "unit";
  units: { id: string; name: string }[];
  daily?: Map<string, UnitDailyData>;
  yearly?: Map<string, UnitYearData>;
}

/** The JSON the route returns. */
export function toPayload({ kind, key, scope, units, daily, yearly }: PayloadSource): ReportPayload {
  return {
    kind,
    key,
    scope,
    fileName: reportFileName(kind, key, scope === "unit" ? units[0]?.name ?? null : null),
    units: units.map(({ id, name }) => ({ id, name })),
    ...(daily ? { daily: Object.fromEntries([...daily].map(([id, data]) => [id, { remittances: data.remittances, expenses: [...data.expensesByDate] }])) } : {}),
    ...(yearly ? { yearly: Object.fromEntries(yearly) } : {}),
  };
}

/** What the sheet builders take, from the JSON. */
export function fromPayload(payload: ReportPayload): BuildInput {
  return {
    kind: payload.kind,
    key: payload.key,
    units: payload.units,
    withSummary: payload.scope === "all",
    ...(payload.daily ? { daily: new Map(Object.entries(payload.daily).map(([id, data]) => [id, { remittances: data.remittances, expensesByDate: new Map(data.expenses) }])) } : {}),
    ...(payload.yearly ? { yearly: new Map(Object.entries(payload.yearly)) } : {}),
  };
}

/** The .xlsx bytes for a payload. The Reports form calls this in the browser. */
export async function buildPayloadWorkbook(payload: ReportPayload): Promise<Uint8Array> {
  return workbookBytes(buildReportSheets(fromPayload(payload)), payload.fileName.replace(/\.xlsx$/, ""));
}

export { xlsxContentType } from "@/lib/reports/xlsx";
