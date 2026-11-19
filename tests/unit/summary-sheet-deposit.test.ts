import { describe, expect, it } from "vitest";
import { buildReportSheets } from "@/lib/reports/build-report";
import type { ReportRemittance, UnitDailyData, UnitYearData } from "@/lib/reports/report-layout";
import { summaryNotes } from "@/lib/reports/summary-sheet";
import type { SheetModel } from "@/lib/reports/xlsx";

// Feature 020: the All units summary links to each unit sheet's total cells, so its Deposit equals the unit sheet's Deposit total
// (payments minus allowance); only the explanatory note lines changed.

const at = (sheet: SheetModel, ref: string) => {
  const match = /^([A-Z]+)(\d+)$/.exec(ref)!;
  return sheet.rows[Number(match[2]) - 1]?.cells[match[1].charCodeAt(0) - 65];
};
const remittance = (date: string, depositCentavos: number): ReportRemittance => ({ date, rentalCentavos: 18000, allowanceCentavos: 4000, depositCentavos, latePayments: [], driverName: "Juan" });
const units = [{ id: "a", name: "rolnet-1" }, { id: "b", name: "rolnet-2" }];
const daily = new Map<string, UnitDailyData>([
  ["a", { remittances: [remittance("2026-10-01", -4000), remittance("2026-10-02", 6000)], expensesByDate: new Map([["2026-10-03", 1000]]) }],
  ["b", { remittances: [remittance("2026-10-01", 14000)], expensesByDate: new Map() }],
]);

describe("All units summary Deposit (feature 020)", () => {
  const sheets = buildReportSheets({ kind: "monthly", key: "2026-10", units, daily, withSummary: true });
  const summary = sheets[0];

  it("shows each unit's Deposit from payments, linked to the unit sheet's total cell", () => {
    expect(at(summary, "C5")?.v).toBe(20);
    expect(at(summary, "C6")?.v).toBe(140);
    expect(at(summary, "C5")?.f).toMatch(/^'rolnet-1'!D\d+$/);
  });

  it("matches the unit sheet's grand total Deposit and sums the rows in the ALL UNITS row", () => {
    const unit = sheets[1];
    const grand = unit.rows.findIndex((row) => row.cells[0]?.v === "GRAND TOTAL") + 1;
    expect(unit.rows[grand - 1].cells[3]?.v).toBe(20);
    expect(at(summary, "C7")?.v).toBe(160);
    expect(at(summary, "C7")?.f).toBe("SUM(C5:C6)");
  });

  it("keeps six summary columns and no Notes column", () => {
    expect(summary.rows[3].cells.map((cell) => cell?.v)).toEqual(["Unit", "Rental", "Deposit", "Allowance", "Expenses", "Net"]);
  });

  it("describes the new Deposit rule in the notes and drops the old sentence", () => {
    for (const kind of ["monthly", "weekly"] as const) {
      expect(summaryNotes[kind].some((line) => line.includes("Rental is the money actually received") && line.includes("Deposit = Rental - Allowance"))).toBe(true);
      expect(summaryNotes[kind].some((line) => line.includes("whatever was paid that day"))).toBe(false);
    }
    expect(summaryNotes.yearly.some((line) => line.includes("Rental is the money actually received") && line.includes("Deposit = Rental - Allowance"))).toBe(true);
  });

  it("builds a Yearly summary from the month deposits", () => {
    const months = (deposit: number): UnitYearData["months"] => Array.from({ length: 12 }, (_, index) => (index === 0 ? { rentalCentavos: 18000, allowanceCentavos: 4000, depositCentavos: deposit } : { rentalCentavos: 0, allowanceCentavos: 0, depositCentavos: 0 }));
    const yearly = new Map<string, UnitYearData>([["a", { months: months(-4000), expenseCentavos: 0 }], ["b", { months: months(14000), expenseCentavos: 0 }]]);
    const built = buildReportSheets({ kind: "yearly", key: "2026", units, yearly, withSummary: true });
    expect(at(built[0], "C5")?.v).toBe(-40);
    expect(at(built[0], "C6")?.v).toBe(140);
    expect(at(built[0], "C7")?.v).toBe(100);
  });
});
