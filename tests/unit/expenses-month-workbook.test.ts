import { describe, expect, it } from "vitest";
import { buildExpensesSheets, buildExpensesWorkbook } from "@/lib/expenses/month-workbook";
import type { ExpenseMonthRow, ExpensesMonthPayload } from "@/lib/expenses/month-data";
import { excelSerial } from "@/lib/reports/periods";
import { sheetXml, StyleRegistry } from "@/lib/reports/xlsx";
import { readWorkbook } from "@/tests/support/xlsx-read";

const expense = (unitId: string, date: string, over: Partial<ExpenseMonthRow> = {}): ExpenseMonthRow => ({ unitId, date, category: "chain", customCategory: null, replacedDate: date, amountCentavos: 125050, notes: "", ...over });
const payload = (over: Partial<ExpensesMonthPayload> = {}): ExpensesMonthPayload => ({
  month: "2026-11", monthLabel: "November 2026", fileName: "rolnet-expenses-2026-11.xlsx",
  units: [{ id: "a", name: "ROLNET-2" }, { id: "b", name: "ROLNET-10" }, { id: "c", name: "ROLNET-11" }],
  expenses: [
    expense("a", "2026-11-03"),
    expense("a", "2026-11-09", { category: "others", customCategory: "Fuel", replacedDate: null, amountCentavos: 50000, notes: "Paid at the shop" }),
    expense("b", "2026-11-05", { category: "battery", replacedDate: "2026-10-30" }),
  ],
  ...over,
});
const sheets = (data = payload()) => [...buildExpensesSheets(data)];

describe("monthly Expenses sheets (feature 019)", () => {
  it("makes one sheet per unit in payload order, including a unit with no expenses", () => {
    expect(sheets().map((sheet) => sheet.name)).toEqual(["ROLNET-2", "ROLNET-10", "ROLNET-11"]);
  });

  it("has the title band with the unit and month and the five columns, with no Unit or receipt column", () => {
    const [first] = sheets();
    expect(first.rows[0].cells[0]?.v).toBe("ROLNET-2  ·  Expenses  ·  November 2026");
    expect(first.rows[3].cells.map((cell) => cell?.v)).toEqual(["Date", "Category", "Amount", "Last replaced", "Notes"]);
    expect(first.columns).toHaveLength(5);
  });

  it("lists expenses oldest first with the custom name for Others and N/A for last replaced", () => {
    const [first] = sheets();
    expect(first.rows[4].cells[0]).toMatchObject({ v: excelSerial("2026-11-03"), s: "dateShort" });
    expect(first.rows[4].cells[1]?.v).toBe("Chain");
    expect(first.rows[4].cells[2]).toMatchObject({ v: 1250.5, s: "amountCents" });
    expect(first.rows[4].cells[3]).toMatchObject({ v: excelSerial("2026-11-03"), s: "dateShort" });
    expect(first.rows[5].cells[1]?.v).toBe("Fuel");
    expect(first.rows[5].cells[3]?.v).toBe("N/A");
    expect(first.rows[5].cells[4]?.v).toBe("Paid at the shop");
  });

  it("ends with a total row that sums the amount", () => {
    const [first] = sheets();
    const total = first.rows.at(-1)!;
    expect(total.cells[0]?.v).toBe("Total");
    expect(total.cells[2]).toMatchObject({ v: 1750.5, f: "SUM(C5:C6)" });
  });

  it("gives a unit with no expenses the title band, a No expenses line and a total of 0", () => {
    const empty = sheets()[2];
    expect(empty.rows[0].cells[0]?.v).toBe("ROLNET-11  ·  Expenses  ·  November 2026");
    expect(empty.rows[4].cells[0]?.v).toBe("No expenses for November 2026");
    expect(empty.rows.at(-1)!.cells[2]).toMatchObject({ v: 0 });
    expect(empty.rows.at(-1)!.cells[2]?.f).toBeUndefined();
    expect(empty.merges).toContain("A5:E5");
  });

  it("follows Excel's sheet name rules: 31 characters, no forbidden characters, duplicates numbered", () => {
    const long = "A very long unit name that goes past thirty-one characters";
    const names = sheets(payload({ units: [{ id: "a", name: long }, { id: "b", name: "Bad:/\\?*[]name" }, { id: "c", name: "Dup" }, { id: "d", name: "dup" }], expenses: [] })).map((sheet) => sheet.name);
    expect(names.every((name) => name.length <= 31)).toBe(true);
    expect(names.every((name) => !/[:\\/?*[\]]/.test(name))).toBe(true);
    expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(4);
    expect(names[3]).toBe("dup (2)");
  });

  it("writes a unit name or note that starts with = as text, never as a formula", async () => {
    const data = payload({ units: [{ id: "a", name: "=1+1,\"QHYRV\"" }], expenses: [expense("a", "2026-11-03", { notes: "=SUM(A1)" })] });
    const workbook = readWorkbook(await buildExpensesWorkbook(data));
    const sheet = workbook.sheets[0];
    expect(sheet.cells.get("A1")?.value).toContain("=1+1");
    expect(sheet.cells.get("A1")?.formula).toBeNull();
    expect(sheet.cells.get("E5")?.value).toBe("=SUM(A1)");
    expect(sheet.cells.get("E5")?.formula).toBeNull();
  });

  it("keeps a very long note and category in their columns, wrapped", () => {
    const [first] = sheets(payload({ expenses: [expense("a", "2026-11-03", { category: "others", customCategory: "C".repeat(40), notes: "n".repeat(300) })] }));
    expect(first.columns).toEqual([12, 26, 16, 16, 64]);
    expect(first.rows[4].cells[4]).toMatchObject({ s: "textWrap" });
    expect(first.rows[4].cells[1]).toMatchObject({ s: "textWrap" });
  });

  it("prints A4 landscape with Narrow margins, one page wide and as tall as needed, repeating the header rows", () => {
    const [first] = sheets();
    const xml = sheetXml(first, new StyleRegistry());
    expect(xml).toContain('paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"');
    expect(xml).toContain('<pageMargins left="0.25" right="0.25" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>');
    expect(first.printTitles).toBe(true);
  });

  it("builds a readable workbook with a sheet per unit", async () => {
    const workbook = readWorkbook(await buildExpensesWorkbook(payload()));
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(["ROLNET-2", "ROLNET-10", "ROLNET-11"]);
  });
});
