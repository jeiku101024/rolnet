import { describe, expect, it } from "vitest";
import { buildReportSheets, reportFileName } from "@/lib/reports/build-report";
import type { ReportRemittance, UnitDailyData } from "@/lib/reports/report-layout";
import { summaryNotes, summarySheet, type SummaryUnit } from "@/lib/reports/summary-sheet";
import type { SheetModel } from "@/lib/reports/xlsx";

const value = (sheet: SheetModel, ref: string) => {
  const match = /^([A-Z]+)(\d+)$/.exec(ref)!;
  return sheet.rows[Number(match[2]) - 1]?.cells[match[1].charCodeAt(0) - 65];
};

const unit = (sheetName: string, rental: number): SummaryUnit => ({
  sheetName,
  linkRefs: ["C56", "D56", "E56", "C57", "C59"],
  totals: { rentalCentavos: rental, depositCentavos: rental - 4000, allowanceCentavos: 4000, expensesCentavos: 1000, netCentavos: 3000 },
});

describe("All units summary sheet (spec Section 5)", () => {
  const sheet = summarySheet("monthly", "October 2026", [unit("rolnet-1", 18000), unit("Mang Ben's", 30000)]);

  it("has the title band, second line and headers", () => {
    expect(value(sheet, "A1")?.v).toBe("October 2026");
    expect(value(sheet, "A2")?.v).toBe("All units  ·  Monthly report");
    expect(sheet.rows[3].cells.map((cell) => cell?.v)).toEqual(["Unit", "Rental", "Deposit", "Allowance", "Expenses", "Net"]);
    expect(sheet.columns).toEqual([26, 15, 15, 15, 15, 15]);
    expect(sheet.merges.slice(0, 2)).toEqual(["A1:F1", "A2:F2"]);
    expect(sheet.tabColor).toBe("1F3864");
    expect(sheet.printTitles).toBe(false);
  });

  it("links each unit row to its sheet with quoted names and cached values", () => {
    expect(value(sheet, "A5")?.v).toBe("rolnet-1");
    expect(value(sheet, "B5")?.f).toBe("'rolnet-1'!C56");
    expect(value(sheet, "B5")?.v).toBe(180);
    expect(value(sheet, "F5")?.f).toBe("'rolnet-1'!C59");
    expect(value(sheet, "B6")?.f).toBe("'Mang Ben''s'!C56");
    expect(sheet.hyperlinks).toEqual([{ ref: "A5", sheet: "rolnet-1" }, { ref: "A6", sheet: "Mang Ben's" }]);
  });

  it("totals the unit rows directly after the last unit", () => {
    expect(value(sheet, "A7")?.v).toBe("ALL UNITS");
    expect(value(sheet, "B7")?.f).toBe("SUM(B5:B6)");
    expect(value(sheet, "F7")?.f).toBe("SUM(F5:F6)");
    expect(value(sheet, "B7")?.v).toBe(480);
    expect(value(sheet, "E7")?.v).toBe(20);
  });

  it("puts the notes two rows below the total, merged across A to F, with the right heights", () => {
    expect(value(sheet, "A9")?.v).toBe("Notes");
    const lines = summaryNotes.monthly;
    lines.forEach((line, index) => {
      expect(value(sheet, `A${10 + index}`)?.v).toBe(line);
      expect(sheet.merges).toContain(`A${10 + index}:F${10 + index}`);
      expect(sheet.rows[9 + index].h).toBe(line.length <= 112 ? 15 : 28);
    });
    expect(sheet.rows).toHaveLength(9 + lines.length);
  });

  it("has the right notes for each report type and never the MOCK DATA line", () => {
    expect(summaryNotes.monthly).toHaveLength(6);
    expect(summaryNotes.weekly).toHaveLength(6);
    expect(summaryNotes.yearly).toHaveLength(5);
    expect(summaryNotes.weekly[1]).toContain("can cross two months");
    expect(summaryNotes.yearly[1]).toContain("Months with no remittances show as -");
    for (const lines of Object.values(summaryNotes)) expect(lines.some((line) => line.includes("MOCK DATA"))).toBe(false);
  });

  it("writes plain zero totals when there are no units", () => {
    const empty = summarySheet("yearly", "2026", []);
    expect(value(empty, "A5")?.v).toBe("ALL UNITS");
    expect(value(empty, "B5")?.f).toBeUndefined();
    expect(value(empty, "B5")?.v).toBe(0);
  });
});

describe("buildReportSheets (feature 014)", () => {
  const remittance = (date: string): ReportRemittance => ({ date, rentalCentavos: 18000, allowanceCentavos: 4000, driverName: "Juan" });
  const data = (dates: string[]): UnitDailyData => ({ remittances: dates.map(remittance), expensesByDate: new Map() });
  const units = [{ id: "a", name: "rolnet-1" }, { id: "b", name: "rolnet-2" }, { id: "c", name: "All units" }];
  const daily = new Map([["a", data(["2026-10-01"])], ["b", data(["2026-10-01", "2026-10-02"])]]);

  it("puts the summary first, names sheets safely, and links the summary to them", () => {
    const sheets = buildReportSheets({ kind: "monthly", key: "2026-10", units, daily, withSummary: true });
    expect(sheets.map((sheet) => sheet.name)).toEqual(["All units", "rolnet-1", "rolnet-2", "All units (unit)"]);
    expect(value(sheets[0], "B7")?.f).toBe("'All units (unit)'!C56");
    expect(value(sheets[0], "B7")?.v).toBe(0);
    expect(value(sheets[0], "B6")?.v).toBe(360);
    expect(value(sheets[0], "B8")?.f).toBe("SUM(B5:B7)");
    expect(value(sheets[0], "B8")?.v).toBe(540);
  });

  it("leaves the summary out of a single unit workbook", () => {
    const sheets = buildReportSheets({ kind: "weekly", key: "2026-10-26", units: [units[0]], daily, withSummary: false });
    expect(sheets.map((sheet) => sheet.name)).toEqual(["rolnet-1"]);
  });

  it("names the files per spec FR-006", () => {
    expect(reportFileName("weekly", "2026-10-26", null)).toBe("rolnet-weekly-2026-10-26-all-units.xlsx");
    expect(reportFileName("monthly", "2026-10", "rolnet-1")).toBe("rolnet-monthly-2026-10-rolnet-1.xlsx");
    expect(reportFileName("yearly", "2026", "Mang Ben's: 2")).toBe("rolnet-yearly-2026-Mang-Ben's-2.xlsx");
  });
});
