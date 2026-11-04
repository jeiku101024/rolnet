import { monthTitle, weekTitle, type ReportKind } from "@/lib/reports/periods";
import { monthlyUnitSheet, weeklyUnitSheet, yearlyUnitSheet, type UnitDailyData, type UnitSheet, type UnitYearData } from "@/lib/reports/report-layout";
import { fileNamePart, sheetNames } from "@/lib/reports/sheet-names";
import { summarySheet } from "@/lib/reports/summary-sheet";
import type { SheetModel } from "@/lib/reports/xlsx";

// Feature 014: turns a report's units and data into the workbook's sheets. Pure, so the download route, the
// mock-comparison tests and the timing test all run the same code.

export interface BuildInput {
  kind: ReportKind;
  /** The period key: YYYY-MM for monthly, the Monday for weekly, YYYY for yearly. */
  key: string;
  /** Units in tab order. */
  units: { id: string; name: string }[];
  daily?: Map<string, UnitDailyData>;
  yearly?: Map<string, UnitYearData>;
  /** True for the All units workbook: the summary sheet comes first. */
  withSummary: boolean;
}

const emptyDaily = (): UnitDailyData => ({ remittances: [], expensesByDate: new Map() });
const emptyYear = (): UnitYearData => ({ months: Array.from({ length: 12 }, () => ({ rentalCentavos: 0, allowanceCentavos: 0 })), expenseCentavos: 0 });

export function periodTitle(kind: ReportKind, key: string) {
  return kind === "monthly" ? monthTitle(key) : kind === "weekly" ? weekTitle(key) : key;
}

export function buildReportSheets({ kind, key, units, daily, yearly, withSummary }: BuildInput): SheetModel[] {
  const names = sheetNames(units.map((unit) => unit.name));
  const built: UnitSheet[] = units.map((unit, index) => {
    if (kind === "monthly") return monthlyUnitSheet(names[index], unit.name, daily?.get(unit.id) ?? emptyDaily(), key);
    if (kind === "weekly") return weeklyUnitSheet(names[index], unit.name, daily?.get(unit.id) ?? emptyDaily(), key);
    return yearlyUnitSheet(names[index], unit.name, yearly?.get(unit.id) ?? emptyYear(), Number(key));
  });
  const unitSheets = built.map((item) => item.sheet);
  if (!withSummary) return unitSheets;
  const summary = summarySheet(kind, periodTitle(kind, key), built.map((item, index) => ({ sheetName: names[index], linkRefs: item.linkRefs, totals: item.totals })));
  return [summary, ...unitSheets];
}

/** The download's file name (spec FR-006): rolnet-monthly-2026-10-all-units.xlsx or …-rolnet-1.xlsx. */
export function reportFileName(kind: ReportKind, key: string, unitName: string | null) {
  return `rolnet-${kind}-${key}-${unitName === null ? "all-units" : fileNamePart(unitName)}.xlsx`;
}
