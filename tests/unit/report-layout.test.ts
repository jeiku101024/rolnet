import { describe, expect, it } from "vitest";
import { monthlyUnitSheet, weeklyUnitSheet, yearlyUnitSheet, type ReportRemittance, type UnitDailyData, type UnitYearData } from "@/lib/reports/report-layout";
import type { Cell, SheetModel } from "@/lib/reports/xlsx";

// Feature 014 (spec Sections 6 to 9, worked examples): the unit sheets' rows, formulas, cached values and
// the cells the All units summary links to.

function cell(sheet: SheetModel, ref: string): Cell | undefined {
  const match = /^([A-Z]+)(\d+)$/.exec(ref)!;
  const column = [...match[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return sheet.rows[Number(match[2]) - 1]?.cells[column];
}
const value = (sheet: SheetModel, ref: string) => cell(sheet, ref)?.v;
const formula = (sheet: SheetModel, ref: string) => cell(sheet, ref)?.f;

const remittance = (date: string, rentalCentavos = 18000, allowanceCentavos = 4000, driverName = "Juan Dela Cruz"): ReportRemittance => ({ date, rentalCentavos, allowanceCentavos, driverName });
const daily = (remittances: ReportRemittance[], expenses: Record<string, number> = {}): UnitDailyData => ({ remittances, expensesByDate: new Map(Object.entries(expenses)) });
const everyDay = (from: number, to: number, month = "2026-10") => Array.from({ length: to - from + 1 }, (_, index) => remittance(`${month}-${String(from + index).padStart(2, "0")}`));

describe("monthly unit sheet (spec Section 6)", () => {
  // October 2026: Oct 1 is a Thursday. Oct 3 has no remittance.
  const oct = [...everyDay(1, 2), ...everyDay(4, 31)];
  const { sheet, linkRefs, totals } = monthlyUnitSheet("rolnet-1", "rolnet-1", daily(oct, { "2026-10-06": 12000, "2026-10-28": 5000 }), "2026-10");

  it("lays out the five week blocks and the grand total at the worked-example rows", () => {
    expect(value(sheet, "A1")).toBe("October 2026");
    expect(value(sheet, "A2")).toBe("Unit rolnet-1  ·  Monthly report");
    expect(["Date", "Driver", "Rental", "Deposit", "Allowance"].map((_, index) => sheet.rows[3].cells[index]?.v)).toEqual(["Date", "Driver", "Rental", "Deposit", "Allowance"]);
    expect(value(sheet, "A9")).toBe("Week 1 Subtotal  ·  Oct 1–4");
    expect([value(sheet, "A10"), value(sheet, "A11"), value(sheet, "A12")]).toEqual(["Expenses:", "Allowance:", "Net:"]);
    expect(value(sheet, "A20")).toBe("Week 2 Subtotal  ·  Oct 5–11");
    expect(value(sheet, "A31")).toBe("Week 3 Subtotal  ·  Oct 12–18");
    expect(value(sheet, "A42")).toBe("Week 4 Subtotal  ·  Oct 19–25");
    expect(value(sheet, "A52")).toBe("Week 5 Subtotal  ·  Oct 26–31");
    expect([value(sheet, "A56"), value(sheet, "A57"), value(sheet, "A58"), value(sheet, "A59")]).toEqual(["GRAND TOTAL", "Expenses:", "Allowance:", "Net:"]);
    expect(sheet.rows).toHaveLength(59);
  });

  it("writes the worked-example formulas", () => {
    expect(formula(sheet, "D5")).toBe("C5-E5");
    expect(formula(sheet, "C9")).toBe("SUM(C5:C8)");
    expect(formula(sheet, "D9")).toBe("SUM(D5:D8)");
    expect(formula(sheet, "E9")).toBe("SUM(E5:E8)");
    expect(formula(sheet, "C11")).toBe("E9");
    expect(formula(sheet, "C12")).toBe("C11-C10");
    expect(formula(sheet, "C56")).toBe("C9+C20+C31+C42+C52");
    expect(formula(sheet, "D56")).toBe("D9+D20+D31+D42+D52");
    expect(formula(sheet, "C57")).toBe("C10+C21+C32+C43+C53");
    expect(formula(sheet, "C58")).toBe("E56");
    expect(formula(sheet, "C59")).toBe("C58-C57");
    expect(formula(sheet, "C10")).toBeUndefined();
  });

  it("links the summary to the grand total block", () => {
    expect(linkRefs).toEqual(["C56", "D56", "E56", "C57", "C59"]);
  });

  it("caches every formula's value from the same sums", () => {
    expect(value(sheet, "D5")).toBe(140);
    expect(value(sheet, "C9")).toBe(540); // Oct 1, 2, 4
    expect(value(sheet, "C10")).toBe(0);
    expect(value(sheet, "C21")).toBe(120);
    expect(value(sheet, "C53")).toBe(50);
    expect(value(sheet, "C56")).toBe(30 * 180);
    expect(value(sheet, "D56")).toBe(30 * 140);
    expect(value(sheet, "E56")).toBe(30 * 40);
    expect(value(sheet, "C57")).toBe(170);
    expect(value(sheet, "C58")).toBe(1200);
    expect(value(sheet, "C59")).toBe(1030);
    expect(totals).toEqual({ rentalCentavos: 540000, depositCentavos: 420000, allowanceCentavos: 120000, expensesCentavos: 17000, netCentavos: 103000 });
  });

  it("lists a day with no remittance with its date and blank cells", () => {
    expect(value(sheet, "A7")).toBe(46298); // Sat, Oct 3
    expect(cell(sheet, "A7")?.s).toBe("date");
    expect([value(sheet, "B7"), value(sheet, "C7"), value(sheet, "D7"), value(sheet, "E7")]).toEqual([null, null, null, null]);
    expect(formula(sheet, "D7")).toBeUndefined();
  });

  it("sets column widths, merges, tab colour, print titles and fixed row heights", () => {
    expect(sheet.columns).toEqual([36, 24, 17, 17, 17]);
    expect(sheet.merges).toEqual(["A1:E1", "A2:E2"]);
    expect(sheet.tabColor).toBe("2F5496");
    expect(sheet.printTitles).toBe(true);
    expect(sheet.rows.slice(0, 4).map((row) => row.h)).toEqual([30, 20, 10, 20]);
    expect(sheet.rows.slice(4).every((row) => row.h === 13)).toBe(true);
  });

  it("writes two rows for a unit with two remittances on one day and counts both", () => {
    const two = monthlyUnitSheet("u", "u", daily([remittance("2026-10-01"), remittance("2026-10-01", 30000, 4000, "Pedro Santos")]), "2026-10").sheet;
    expect(value(two, "A5")).toBe(value(two, "A6"));
    expect([value(two, "B5"), value(two, "B6")]).toEqual(["Juan Dela Cruz", "Pedro Santos"]);
    expect(value(two, "A10")).toBe("Week 1 Subtotal  ·  Oct 1–4");
    expect(formula(two, "C10")).toBe("SUM(C5:C9)");
    expect(value(two, "C10")).toBe(480);
  });

  it("gives a month that starts on a Sunday six blocks, the first being one day", () => {
    const november = monthlyUnitSheet("u", "u", daily([remittance("2026-11-01")]), "2026-11").sheet;
    expect(value(november, "A1")).toBe("November 2026");
    expect(value(november, "A6")).toBe("Week 1 Subtotal  ·  Nov 1");
    const labels = november.rows.map((row) => row.cells[0]?.v).filter((label): label is string => typeof label === "string" && label.startsWith("Week"));
    expect(labels).toEqual(["Week 1 Subtotal  ·  Nov 1", "Week 2 Subtotal  ·  Nov 2–8", "Week 3 Subtotal  ·  Nov 9–15", "Week 4 Subtotal  ·  Nov 16–22", "Week 5 Subtotal  ·  Nov 23–29", "Week 6 Subtotal  ·  Nov 30"]);
  });

  it("still lists every date for a month without remittances, with zero totals", () => {
    const empty = monthlyUnitSheet("u", "u", daily([]), "2026-10");
    expect(empty.sheet.rows).toHaveLength(59);
    expect(value(empty.sheet, "C56")).toBe(0);
    expect(empty.totals.netCentavos).toBe(0);
  });

  it("writes centavos exactly", () => {
    const odd = monthlyUnitSheet("u", "u", daily([remittance("2026-10-01", 18050, 4000)]), "2026-10").sheet;
    expect(value(odd, "C5")).toBe(180.5);
    expect(value(odd, "D5")).toBe(140.5);
  });
});

describe("weekly unit sheet (spec Section 7)", () => {
  // Week of Oct 26 – Nov 1, 2026: Thursday Oct 29 has no remittance.
  const week = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-30", "2026-10-31", "2026-11-01"].map((date) => remittance(date));
  const { sheet, linkRefs } = weeklyUnitSheet("rolnet-1", "rolnet-1", daily(week, { "2026-10-30": 3000, "2026-11-01": 2000 }), "2026-10-26");

  it("shows the seven days, one Week Subtotal block and no grand total", () => {
    expect(value(sheet, "A1")).toBe("Week of Oct 26 – Nov 1, 2026");
    expect(value(sheet, "A2")).toBe("Unit rolnet-1  ·  Weekly report");
    expect(value(sheet, "A5")).toBe(46321);
    expect(value(sheet, "A11")).toBe(46327);
    expect(value(sheet, "A12")).toBe("Week Subtotal  ·  Oct 26–Nov 1");
    expect([value(sheet, "A13"), value(sheet, "A14"), value(sheet, "A15")]).toEqual(["Expenses:", "Allowance:", "Net:"]);
    expect(sheet.rows).toHaveLength(15);
  });

  it("writes the worked-example formulas and links", () => {
    expect(formula(sheet, "C12")).toBe("SUM(C5:C11)");
    expect(formula(sheet, "C14")).toBe("E12");
    expect(formula(sheet, "C15")).toBe("C14-C13");
    expect(linkRefs).toEqual(["C12", "D12", "E12", "C13", "C15"]);
  });

  it("adds expenses from both months and shows a blank day", () => {
    expect(value(sheet, "C13")).toBe(50);
    expect(value(sheet, "C14")).toBe(240);
    expect(value(sheet, "C15")).toBe(190);
    expect([value(sheet, "B8"), value(sheet, "C8"), value(sheet, "D8"), value(sheet, "E8")]).toEqual([null, null, null, null]);
  });

  it("uses height 16 from row 5 and the same columns as the monthly sheet", () => {
    expect(sheet.columns).toEqual([36, 24, 17, 17, 17]);
    expect(sheet.rows.slice(4).every((row) => row.h === 16)).toBe(true);
  });

  it("titles a week inside one month and a week across two years", () => {
    expect(value(weeklyUnitSheet("u", "u", daily([]), "2026-10-19").sheet, "A1")).toBe("Week of Oct 19 – 25, 2026");
    const years = weeklyUnitSheet("u", "u", daily([]), "2026-12-28").sheet;
    expect(value(years, "A1")).toBe("Week of Dec 28, 2026 – Jan 3, 2027");
    expect(value(years, "A12")).toBe("Week Subtotal  ·  Dec 28–Jan 3");
  });

  it("matches the monthly sheet's rows for the same days", () => {
    const month = monthlyUnitSheet("u", "u", daily(week), "2026-10").sheet;
    // Oct 26–31 are rows 46–51 of the monthly sheet and rows 5–10 of the weekly sheet.
    for (let offset = 0; offset < 6; offset++) {
      for (const column of ["A", "B", "C", "E"]) expect(value(sheet, `${column}${5 + offset}`)).toEqual(value(month, `${column}${46 + offset}`));
    }
  });
});

describe("yearly unit sheet (spec Section 8)", () => {
  const months = Array.from({ length: 12 }, (_, index) => (index === 9 ? { rentalCentavos: 540000, allowanceCentavos: 120000 } : { rentalCentavos: 0, allowanceCentavos: 0 }));
  const data: UnitYearData = { months, expenseCentavos: 17000 };
  const { sheet, linkRefs, totals } = yearlyUnitSheet("rolnet-1", "rolnet-1", data, 2026);

  it("lists January to December and the subtotal and grand total blocks at rows 5 to 24", () => {
    expect(value(sheet, "A1")).toBe("2026");
    expect(value(sheet, "A2")).toBe("Unit rolnet-1  ·  Yearly report");
    expect(sheet.rows[3].cells.map((item) => item?.v)).toEqual(["Month", "Rental", "Deposit", "Allowance"]);
    expect(value(sheet, "A5")).toBe(46023); // 2026-01-01
    expect(cell(sheet, "A5")?.s).toBe("month");
    expect(value(sheet, "A16")).toBe(46357); // 2026-12-01
    expect(value(sheet, "A17")).toBe("Year Subtotal  ·  Jan–Dec");
    expect([value(sheet, "A18"), value(sheet, "A19"), value(sheet, "A20")]).toEqual(["Expenses:", "Allowance:", "Net:"]);
    expect([value(sheet, "A21"), value(sheet, "A22"), value(sheet, "A23"), value(sheet, "A24")]).toEqual(["GRAND TOTAL", "Expenses:", "Allowance:", "Net:"]);
    expect(sheet.rows).toHaveLength(24);
  });

  it("writes the worked-example formulas and links", () => {
    expect(formula(sheet, "C5")).toBe("B5-D5");
    expect(formula(sheet, "B17")).toBe("SUM(B5:B16)");
    expect(formula(sheet, "C17")).toBe("SUM(C5:C16)");
    expect(formula(sheet, "D17")).toBe("SUM(D5:D16)");
    expect(formula(sheet, "B19")).toBe("D17");
    expect(formula(sheet, "B20")).toBe("B19-B18");
    expect([formula(sheet, "B21"), formula(sheet, "C21"), formula(sheet, "D21")]).toEqual(["B17", "C17", "D17"]);
    expect(formula(sheet, "B22")).toBe("B18");
    expect(formula(sheet, "B23")).toBe("D21");
    expect(formula(sheet, "B24")).toBe("B23-B22");
    expect(formula(sheet, "B18")).toBeUndefined();
    expect(linkRefs).toEqual(["B21", "C21", "D21", "B22", "B24"]);
  });

  it("caches the values and shows empty months as zero", () => {
    expect(value(sheet, "B5")).toBe(0);
    expect(value(sheet, "B14")).toBe(5400);
    expect(value(sheet, "C14")).toBe(4200);
    expect(value(sheet, "B17")).toBe(5400);
    expect(value(sheet, "B18")).toBe(170);
    expect(value(sheet, "B20")).toBe(1030);
    expect(value(sheet, "B24")).toBe(1030);
    expect(totals).toEqual({ rentalCentavos: 540000, depositCentavos: 420000, allowanceCentavos: 120000, expensesCentavos: 17000, netCentavos: 103000 });
  });

  it("uses the yearly widths, merges and height 16 from row 5", () => {
    expect(sheet.columns).toEqual([30, 24, 24, 24]);
    expect(sheet.merges).toEqual(["A1:D1", "A2:D2"]);
    expect(sheet.rows.slice(4).every((row) => row.h === 16)).toBe(true);
  });

  it("matches the monthly grand total for the same data", () => {
    const month = monthlyUnitSheet("u", "u", daily(everyDay(1, 31), { "2026-10-06": 17000 }), "2026-10");
    const year = yearlyUnitSheet("u", "u", { months: months.map((item, index) => (index === 9 ? { rentalCentavos: month.totals.rentalCentavos, allowanceCentavos: month.totals.allowanceCentavos } : item)), expenseCentavos: 17000 }, 2026);
    expect(value(year.sheet, "B14")).toBe(value(month.sheet, "C56"));
    expect(value(year.sheet, "C14")).toBe(value(month.sheet, "D56"));
    expect(value(year.sheet, "D14")).toBe(value(month.sheet, "E56"));
  });
});
