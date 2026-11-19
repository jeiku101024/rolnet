import { describe, expect, it } from "vitest";
import { buildReportSheets, reportFileName } from "@/lib/reports/build-report";
import type { ReportRemittance, UnitDailyData, UnitYearData } from "@/lib/reports/report-layout";
import type { SheetModel } from "@/lib/reports/xlsx";
import { workbookBytes } from "@/lib/reports/xlsx";
import { readWorkbook } from "@/tests/support/xlsx-read";

// Feature 020 (spec Story 3, FR-009): only Deposit values, the cells that add them, and the new Notes column change. A paid-in-full
// month and the same month with one unpaid remittance differ in nothing else.

const remittance = (date: string, paid: boolean): ReportRemittance => ({ date, rentalCentavos: 18000, allowanceCentavos: 4000, depositCentavos: paid ? 14000 : -4000, latePayments: [], driverName: "Juan" });
const units = [{ id: "a", name: "rolnet-1" }, { id: "b", name: "rolnet-2" }];
const dailyOf = (unpaidDate: string | null) => new Map<string, UnitDailyData>([
  ["a", { remittances: ["2026-10-01", "2026-10-02", "2026-10-08"].map((date) => remittance(date, date !== unpaidDate)), expensesByDate: new Map([["2026-10-03", 1000]]) }],
  ["b", { remittances: [remittance("2026-10-01", true)], expensesByDate: new Map() }],
]);
const monthsOf = (unpaid: boolean): UnitYearData["months"] => Array.from({ length: 12 }, (_, index) => (index === 9 ? { rentalCentavos: 54000, allowanceCentavos: 12000, depositCentavos: unpaid ? 24000 : 30000 } : { rentalCentavos: 0, allowanceCentavos: 0, depositCentavos: 0 }));

/** The cell references whose value, formula or style differ between two sheets built from the same layout. */
function changedCells(a: SheetModel, b: SheetModel) {
  expect(a.rows).toHaveLength(b.rows.length);
  const changed: string[] = [];
  a.rows.forEach((row, r) => {
    const length = Math.max(row.cells.length, b.rows[r].cells.length);
    for (let c = 0; c < length; c++) {
      const x = row.cells[c];
      const y = b.rows[r].cells[c];
      if (JSON.stringify(x) !== JSON.stringify(y)) changed.push(`${String.fromCharCode(65 + c)}${r + 1}`);
    }
  });
  return changed;
}

describe("only Deposit and the cells that add it change (feature 020)", () => {
  for (const kind of ["monthly", "weekly"] as const) {
    it(`${kind}: an unpaid remittance changes its Deposit cell and the Deposit totals, nothing else`, () => {
      const key = kind === "monthly" ? "2026-10" : "2026-10-05";
      const paid = buildReportSheets({ kind, key, units, daily: dailyOf(null), withSummary: true });
      const unpaid = buildReportSheets({ kind, key, units, daily: dailyOf("2026-10-08"), withSummary: true });
      expect(unpaid.map((sheet) => sheet.name)).toEqual(paid.map((sheet) => sheet.name));
      expect(unpaid.map((sheet) => sheet.tabColor)).toEqual(paid.map((sheet) => sheet.tabColor));
      for (const [index, sheet] of unpaid.entries()) {
        expect(sheet.columns).toEqual(paid[index].columns);
        expect(sheet.merges).toEqual(paid[index].merges);
        const columns = new Set(changedCells(sheet, paid[index]).map((ref) => ref.replace(/\d+$/, "")));
        // Sheet 0 is the All units summary (Deposit is column C there); unit sheets keep Deposit in column D.
        expect([...columns].every((column) => column === (index === 0 ? "C" : "D"))).toBe(true);
      }
    });
  }

  it("yearly: an unpaid month changes its Deposit cell and the Deposit totals, nothing else", () => {
    const withMonths = (unpaid: boolean) => buildReportSheets({ kind: "yearly", key: "2026", units, yearly: new Map([["a", { months: monthsOf(unpaid), expenseCentavos: 0 }], ["b", { months: monthsOf(false), expenseCentavos: 0 }]]), withSummary: true });
    const paid = withMonths(false);
    const unpaid = withMonths(true);
    for (const [index, sheet] of unpaid.entries()) {
      const columns = new Set(changedCells(sheet, paid[index]).map((ref) => ref.replace(/\d+$/, "")));
      expect([...columns].every((column) => column === (index === 0 ? "C" : "C"))).toBe(true);
    }
  });

  it("keeps file names, sheet order and the Yearly and summary column counts", async () => {
    expect(reportFileName("monthly", "2026-10", null)).toBe("rolnet-monthly-2026-10-all-units.xlsx");
    const sheets = buildReportSheets({ kind: "weekly", key: "2026-10-05", units, daily: dailyOf(null), withSummary: true });
    const workbook = readWorkbook(await workbookBytes(sheets));
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(["All units", "rolnet-1", "rolnet-2"]);
    expect(sheets[0].rows[3].cells).toHaveLength(6);
    expect(sheets[1].rows[3].cells).toHaveLength(6);
    expect(workbook.sheets[1].pageSetup?.orientation).toBe("portrait");
    expect(workbook.sheets[1].pageSetup?.fitToWidth).toBe("1");
  });
});
