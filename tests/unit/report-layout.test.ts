import { describe, expect, it } from "vitest";
import { monthlySheet, weeklySheet, yearlySheet, type ReportData, type ReportRemittance } from "@/lib/reports/report-layout";
import { displayText, workbookBytes, type Cell, type Sheet } from "@/lib/reports/xlsx";
import { zipText } from "@/tests/support/stored-zip";

const remittance = (service_date: string, paid: number, driverName = "Alroy", rental = 30000): ReportRemittance =>
  ({ service_date, rentalCentavos: rental, allowanceCentavos: 4000, depositCentavos: paid - 4000, driverName });

// January 2025 starts on a Wednesday: Week 1 is Wed 1 to Sun 5.
const january: ReportData = {
  remittances: [remittance("2025-01-03", 30000), remittance("2025-01-03", 0, "Ben", 18000), remittance("2025-01-07", 18000, "Ben", 18000), remittance("2025-01-31", 10050, "Cy", 18000)],
  expensesByDate: new Map([["2025-01-02", 15000], ["2025-01-08", 50000], ["2025-02-01", 99900]]),
};

const values = (row: Cell[]) => row.map((cell) => cell.value);
const find = (sheet: Sheet, label: string, from = 0) => sheet.rows.findIndex((row, index) => index >= from && row[1]?.value === label);
const at = (sheet: Sheet, rowIndex: number, column: number) => sheet.rows[rowIndex][column];

describe("weekly and monthly sheets (feature 009, contracts/report-sheets.md)", () => {
  const sheet = monthlySheet(january, "2025-01");

  it("has the template's header and one row per remittance, with blank no-remittance days", () => {
    expect(values(sheet.rows[0])).toEqual(["Week", "Day", "Driver", "Rental", "Deposit", "Allowance", "Month", "Year"]);
    expect(sheet.rows[0].every((cell) => cell.style === "header")).toBe(true);
    expect(values(sheet.rows[1])).toEqual([1, "Wed", null, null, null, null, "Jan", 2025]);
    expect(values(sheet.rows[3])).toEqual([1, "Fri", "Alroy", 300, 260, 40, "Jan", 2025]);
    expect(values(sheet.rows[4])).toEqual([1, "Fri", "Ben", 180, -40, 40, "Jan", 2025]);
    expect(at(sheet, 3, 6).style).toBe("bodyGreen");
    expect(at(sheet, 3, 7).style).toBe("bodyGreen");
    const remittanceRows = sheet.rows.filter((row) => typeof row[2]?.value === "string" && row[2].style === "body");
    expect(remittanceRows).toHaveLength(4);
    expect(remittanceRows.every((row) => row[5].value === 40)).toBe(true);
  });

  it("closes each week with Subtotal, Expenses, Allowance and Net formulas", () => {
    const subtotal = find(sheet, "Week 1 Subtotal");
    expect(subtotal).toBe(7);
    const excelRow = subtotal + 1;
    expect(at(sheet, subtotal, 3)).toMatchObject({ formula: "SUM(D2:D7)", value: 480, style: "subtotal" });
    expect(at(sheet, subtotal, 4)).toMatchObject({ formula: "SUM(E2:E7)", value: 220 });
    expect(at(sheet, subtotal, 5)).toMatchObject({ formula: "SUM(F2:F7)", value: 80 });
    expect(sheet.rows[subtotal].every((cell) => cell.style === "subtotal")).toBe(true);
    expect(sheet.rows[subtotal + 1].slice(1, 4).map((cell) => [cell.value, cell.style])).toEqual([["Expenses:", "italicLine"], [null, "italicLine"], [150, "italicLine"]]);
    expect(at(sheet, subtotal + 2, 1).value).toBe("Allowance:");
    expect(at(sheet, subtotal + 2, 3)).toMatchObject({ formula: `F${excelRow}`, value: 80, style: "italicLine" });
    expect(at(sheet, subtotal + 3, 1)).toMatchObject({ value: "Net:", style: "netLine" });
    expect(at(sheet, subtotal + 3, 3)).toMatchObject({ formula: `D${excelRow + 2}-D${excelRow + 1}`, value: -70, style: "netLine" });
  });

  it("ends a month with a GRAND TOTAL over the week subtotals", () => {
    const subtotals = sheet.rows.flatMap((row, index) => (/^Week \d Subtotal$/.test(String(row[1]?.value)) ? [index + 1] : []));
    expect(subtotals).toHaveLength(5);
    const grand = find(sheet, "GRAND TOTAL");
    expect(at(sheet, grand, 3)).toMatchObject({ formula: subtotals.map((row) => `D${row}`).join("+"), value: 300 + 180 + 180 + 180 });
    expect(at(sheet, grand, 4).value).toBe(260 - 40 + 140 + 60.5);
    expect(at(sheet, grand, 4).format).toBe("decimal");
    expect(sheet.rows[grand].every((cell) => cell.style === "grandTop")).toBe(true);
    expect(at(sheet, grand + 1, 3)).toMatchObject({ formula: subtotals.map((row) => `D${row + 1}`).join("+"), value: 650, style: "grandItalic" });
    expect(at(sheet, grand + 2, 3)).toMatchObject({ formula: `F${grand + 1}`, value: 160, style: "grandItalic" });
    expect(at(sheet, grand + 3, 3)).toMatchObject({ formula: `D${grand + 3}-D${grand + 2}`, value: -490 });
    expect(sheet.rows[grand + 3].every((cell) => cell.style === "grandBottom")).toBe(true);
    expect(sheet.rows).toHaveLength(grand + 4);
  });

  it("keeps a month's days inside the month", () => {
    const lastWeek = sheet.rows.filter((row) => row[0]?.value === 5 && row[0].style === "body");
    expect(lastWeek.map((row) => row[1].value)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(lastWeek.every((row) => row[6].value === "Jan")).toBe(true);
  });

  it("writes one week block for a Weekly report, crossing into the next month", () => {
    const weekly = weeklySheet(january, "2025-01-27");
    expect(find(weekly, "GRAND TOTAL")).toBe(-1);
    expect(weekly.rows.filter((row) => /Subtotal$/.test(String(row[1]?.value)))).toHaveLength(1);
    expect(find(weekly, "Week 5 Subtotal")).toBeGreaterThan(0);
    const dayRows = weekly.rows.slice(1, 8);
    expect(dayRows.map((row) => `${row[1].value} ${row[6].value} ${row[7].value}`)).toEqual(["Mon Jan 2025", "Tue Jan 2025", "Wed Jan 2025", "Thu Jan 2025", "Fri Jan 2025", "Sat Feb 2025", "Sun Feb 2025"]);
    expect(dayRows.every((row) => row[0].value === 5)).toBe(true);
    // Expenses include Sat 1 Feb, inside this week.
    expect(at(weekly, find(weekly, "Expenses:"), 3).value).toBe(999);
    expect(weekly.name).toBe("Weekly");
  });

  it("names the unit in a unit report's sheet (FR-023)", () => {
    expect(monthlySheet(january, "2025-01", "ROLNET-1").name).toBe("Monthly - ROLNET-1");
    const xml = zipText(workbookBytes(monthlySheet(january, "2025-01", "Unit: [Night/Shift] with a very long name")), "xl/workbook.xml");
    const name = /<sheet name="([^"]+)"/.exec(xml)?.[1] ?? "";
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[[\]:*?/\\]/);
  });

  it("sizes every column to fit its text (FR-038)", () => {
    for (const built of [sheet, weeklySheet(january, "2025-01-27"), yearlySheet(january, 2025)]) {
      built.columns.forEach((width, column) => {
        const longest = Math.max(...built.rows.map((row) => (row[column] ? displayText(row[column]).length : 0)));
        expect(width).toBeGreaterThanOrEqual(longest + 2);
      });
    }
  });

  it("builds a busy month quickly (SC-005)", () => {
    const busy: ReportData = { remittances: Array.from({ length: 31 * 50 }, (_, index) => remittance(`2025-01-${String((index % 31) + 1).padStart(2, "0")}`, 18000, `Driver ${index % 50}`)), expensesByDate: new Map() };
    const started = performance.now();
    workbookBytes(monthlySheet(busy, "2025-01"));
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("yearly sheet (feature 009, User Story 4)", () => {
  const sheet = yearlySheet({ remittances: january.remittances, expensesByDate: new Map([["2025-01-02", 15000], ["2024-12-31", 77700]]) }, 2025);

  it("totals each month, with zero months shown as \"-\"", () => {
    expect(values(sheet.rows[0])).toEqual(["Year", "Month", "Rental", "Deposit", "Allowance"]);
    expect(values(sheet.rows[1])).toEqual([2025, "Jan", 840, 420.5, 160]);
    expect(at(sheet, 1, 0).style).toBe("bodyGreen");
    expect(at(sheet, 1, 1).style).toBe("bodyGreen");
    expect(sheet.rows.slice(1, 13).map((row) => row[1].value)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
    expect(values(sheet.rows[2])).toEqual([2025, "Feb", 0, 0, 0]);
    expect(at(sheet, 2, 2).format).toBe("yearWhole");
    expect(displayText(at(sheet, 2, 2))).toBe("-");
  });

  it("adds the Year Subtotal, its lines and the GRAND TOTAL block", () => {
    expect(at(sheet, 13, 1).value).toBe("Year Subtotal");
    expect([at(sheet, 13, 2).formula, at(sheet, 13, 3).formula, at(sheet, 13, 4).formula]).toEqual(["SUM(C2:C13)", "SUM(D2:D13)", "SUM(E2:E13)"]);
    expect(sheet.rows[13].every((cell) => cell.style === "subtotal")).toBe(true);
    expect(at(sheet, 14, 2)).toMatchObject({ value: 150, style: "italicLine" });
    expect(at(sheet, 15, 2)).toMatchObject({ formula: "E14", value: 160, style: "italicLine" });
    expect(at(sheet, 16, 2)).toMatchObject({ formula: "C16-C15", value: 10, style: "netLine" });
    expect(at(sheet, 17, 1).value).toBe("GRAND TOTAL");
    expect(sheet.rows[17].every((cell) => cell.style === "grandTop")).toBe(true);
    expect([at(sheet, 17, 2).formula, at(sheet, 18, 2).formula, at(sheet, 19, 2).formula, at(sheet, 20, 2).formula]).toEqual(["C14", "C15", "E18", "C20-C19"]);
    expect(sheet.rows[20].every((cell) => cell.style === "grandBottom")).toBe(true);
    expect(sheet.rows).toHaveLength(21);
  });
});
