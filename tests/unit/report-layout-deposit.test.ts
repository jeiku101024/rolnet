import { describe, expect, it } from "vitest";
import { excelSerial } from "@/lib/reports/periods";
import { monthlyUnitSheet, weeklyUnitSheet, yearlyUnitSheet, type ReportRemittance, type UnitDailyData, type UnitYearData } from "@/lib/reports/report-layout";
import type { SheetModel } from "@/lib/reports/xlsx";

// Feature 020: Deposit is what was actually received (payments minus allowance), not Rental minus Allowance, and the Weekly and
// Monthly unit sheets note a payment that arrived after the service date in a new Notes column.

const at = (sheet: SheetModel, ref: string) => {
  const match = /^([A-Z]+)(\d+)$/.exec(ref)!;
  const column = [...match[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return sheet.rows[Number(match[2]) - 1]?.cells[column];
};
const value = (sheet: SheetModel, ref: string) => at(sheet, ref)?.v;
const formula = (sheet: SheetModel, ref: string) => at(sheet, ref)?.f;
/** The sheet row (1-based) of a date, found by its Excel date serial in column A. */
const rowOf = (sheet: SheetModel, date: string) => sheet.rows.findIndex((row) => row.cells[0]?.v === excelSerial(date)) + 1;

const remittance = (date: string, depositCentavos: number, over: Partial<ReportRemittance> = {}): ReportRemittance => ({ date, rentalCentavos: 18000, allowanceCentavos: 4000, depositCentavos, latePayments: [], driverName: "Juan Dela Cruz", ...over });
const daily = (remittances: ReportRemittance[], expenses: Record<string, number> = {}): UnitDailyData => ({ remittances, expensesByDate: new Map(Object.entries(expenses)) });

// Oct 6 unpaid (-40), Oct 7 ₱100 paid (60), Oct 8 paid in full (140), Oct 9 paid in full but ₱180 of it on Oct 12.
const week = [
  remittance("2026-10-06", -4000),
  remittance("2026-10-07", 6000),
  remittance("2026-10-08", 14000),
  remittance("2026-10-09", 14000, { latePayments: [{ date: "2026-10-12", amountCentavos: 18000 }] }),
];

describe("Deposit on the Monthly and Weekly unit sheets (feature 020)", () => {
  const monthly = monthlyUnitSheet("u", "u", daily(week, { "2026-10-06": 1000 }), "2026-10");
  const weekly = weeklyUnitSheet("u", "u", daily(week, { "2026-10-06": 1000 }), "2026-10-05");

  it("shows an unpaid day as a negative Deposit while Rental stays the charge", () => {
    for (const sheet of [monthly.sheet, weekly.sheet]) {
      const row = rowOf(sheet, "2026-10-06");
      expect(value(sheet, `C${row}`)).toBe(180);
      expect(value(sheet, `D${row}`)).toBe(-40);
      expect(value(sheet, `E${row}`)).toBe(40);
    }
  });

  it("shows a part-paid day and a fully paid day from the payments", () => {
    const row7 = rowOf(monthly.sheet, "2026-10-07");
    const row8 = rowOf(monthly.sheet, "2026-10-08");
    expect(value(monthly.sheet, `D${row7}`)).toBe(60);
    expect(value(monthly.sheet, `D${row8}`)).toBe(140);
  });

  it("writes a day Deposit as a plain number, not a formula of Rental and Allowance", () => {
    const row = rowOf(monthly.sheet, "2026-10-06");
    expect(formula(monthly.sheet, `D${row}`)).toBeUndefined();
  });

  it("adds the Deposit cells in the week subtotal and the grand total, with live sums", () => {
    const sub = weekly.sheet.rows.findIndex((row) => String(row.cells[0]?.v).startsWith("Week Subtotal")) + 1;
    expect(formula(weekly.sheet, `D${sub}`)).toBe(`SUM(D5:D${sub - 1})`);
    expect(value(weekly.sheet, `D${sub}`)).toBe(-40 + 60 + 140 + 140);
    const grand = monthly.sheet.rows.findIndex((row) => row.cells[0]?.v === "GRAND TOTAL") + 1;
    expect(value(monthly.sheet, `D${grand}`)).toBe(300);
    expect(formula(monthly.sheet, `D${grand}`)).toMatch(/^D\d+(\+D\d+)+$/);
  });

  it("reports the summed deposits as the unit total, and Net stays Allowance minus Expenses", () => {
    expect(monthly.totals.depositCentavos).toBe(30000);
    expect(weekly.totals.depositCentavos).toBe(30000);
    expect(monthly.totals.rentalCentavos).toBe(72000);
    expect(monthly.totals.allowanceCentavos).toBe(16000);
    expect(monthly.totals.netCentavos).toBe(16000 - 1000);
  });

  it("lists a day with no remittance with blank cells, Notes included", () => {
    const row = rowOf(monthly.sheet, "2026-10-01");
    expect(monthly.sheet.rows[row - 1].cells.slice(1).map((cell) => cell?.v)).toEqual([null, null, null, null, null]);
  });
});

describe("Notes column on the Monthly and Weekly unit sheets (feature 020)", () => {
  const sheets = [monthlyUnitSheet("u", "u", daily(week), "2026-10").sheet, weeklyUnitSheet("u", "u", daily(week), "2026-10-05").sheet];

  it("adds Notes as the sixth header and widens the bands to six columns", () => {
    for (const sheet of sheets) {
      expect(sheet.rows[3].cells.map((cell) => cell?.v)).toEqual(["Date", "Driver", "Rental", "Deposit", "Allowance", "Notes"]);
      expect(sheet.merges).toEqual(["A1:F1", "A2:F2"]);
      expect(sheet.columns).toEqual([36, 24, 17, 17, 17, 44]);
    }
  });

  it("notes a payment that arrived after the service date", () => {
    for (const sheet of sheets) expect(value(sheet, `F${rowOf(sheet, "2026-10-09")}`)).toBe("Received later: ₱180.00 on Oct 12");
  });

  it("reads a short summary for several late payments", () => {
    const many = remittance("2026-10-09", 14000, { latePayments: [{ date: "2026-10-10", amountCentavos: 6000 }, { date: "2026-10-11", amountCentavos: 6000 }, { date: "2026-10-12", amountCentavos: 6000 }] });
    const sheet = weeklyUnitSheet("u", "u", daily([many]), "2026-10-05").sheet;
    expect(value(sheet, `F${rowOf(sheet, "2026-10-09")}`)).toBe("Received later: 3 payments, ₱180.00 (last Oct 12)");
  });

  it("leaves Notes empty on a row with no late payment", () => {
    for (const sheet of sheets) {
      for (const date of ["2026-10-06", "2026-10-07", "2026-10-08"]) expect(value(sheet, `F${rowOf(sheet, date)}`)).toBeNull();
    }
  });

  it("shades a blank Notes cell on subtotal and grand total rows and never sums Notes", () => {
    for (const sheet of sheets) {
      const subtotal = sheet.rows.find((row) => String(row.cells[0]?.v).includes("Subtotal"))!;
      expect(subtotal.cells[5]).toMatchObject({ v: null, s: "subAmount" });
      expect(subtotal.cells[5]?.f).toBeUndefined();
    }
    const grand = sheets[0].rows.find((row) => row.cells[0]?.v === "GRAND TOTAL")!;
    expect(grand.cells[5]).toMatchObject({ v: null, s: "grandAmount" });
  });

  it("does not let a Notes text change any total", () => {
    const plain = weeklyUnitSheet("u", "u", daily(week.map((item) => ({ ...item, latePayments: [] }))), "2026-10-05");
    const noted = weeklyUnitSheet("u", "u", daily(week), "2026-10-05");
    expect(noted.totals).toEqual(plain.totals);
  });
});

describe("Deposit on the Yearly unit sheet (feature 020)", () => {
  const months = Array.from({ length: 12 }, (_, index) => (index === 9 ? { rentalCentavos: 72000, allowanceCentavos: 16000, depositCentavos: 30000 } : { rentalCentavos: 0, allowanceCentavos: 0, depositCentavos: 0 }));
  const data: UnitYearData = { months, expenseCentavos: 1000 };
  const { sheet, totals } = yearlyUnitSheet("u", "u", data, 2026);

  it("writes a month Deposit from the payments, as a plain number", () => {
    expect(value(sheet, "C14")).toBe(300);
    expect(formula(sheet, "C14")).toBeUndefined();
  });

  it("shows an unpaid month as a negative Deposit", () => {
    const unpaid = yearlyUnitSheet("u", "u", { months: months.map((month, index) => (index === 0 ? { rentalCentavos: 18000, allowanceCentavos: 4000, depositCentavos: -4000 } : month)), expenseCentavos: 0 }, 2026);
    expect(value(unpaid.sheet, "C5")).toBe(-40);
  });

  it("sums the months in the year subtotal and grand total, with live formulas", () => {
    expect(formula(sheet, "C17")).toBe("SUM(C5:C16)");
    expect(value(sheet, "C17")).toBe(300);
    expect(value(sheet, "C21")).toBe(300);
    expect(totals.depositCentavos).toBe(30000);
  });

  it("keeps four columns, with no Notes column", () => {
    expect(sheet.rows[3].cells.map((cell) => cell?.v)).toEqual(["Month", "Rental", "Deposit", "Allowance"]);
    expect(sheet.columns).toEqual([30, 24, 24, 24]);
  });
});
