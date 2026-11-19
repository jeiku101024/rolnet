import { categoryText } from "@/lib/expenses/categories";
import type { ExpenseMonthRow, ExpensesMonthPayload } from "@/lib/expenses/month-data";
import { formatPesos } from "@/lib/money/centavos";
import { excelSerial } from "@/lib/reports/periods";
import { sheetNames } from "@/lib/reports/sheet-names";
import { workbookBytes, type Cell, type Row, type SheetModel, type StyleName } from "@/lib/reports/xlsx";

// Feature 019 (contracts/expenses-month.md): one sheet per unit for one month, built in the browser with the
// feature 014 workbook writer. A4 landscape, Narrow margins, one page wide and as many pages tall as needed, with the
// header rows repeated. Columns mirror a row of the Expenses page without the Unit and receipt columns. Text goes in
// as inline strings, so a unit name or note that starts with "=" is shown as text and never evaluated.

const tabColor = "1F3864";
const columns = [12, 26, 16, 16, 64];
const pesos = (centavos: number) => centavos / 100;
const text = (v: string, s: StyleName): Cell => ({ v, s });
const blank = (s: StyleName): Cell => ({ v: null, s });
const band = (first: string, style: StyleName): (Cell | undefined)[] => [text(first, style), ...Array.from({ length: columns.length - 1 }, () => blank(style))];

/** One unit's sheet: header block (rows 1 to 4), its expenses oldest first (or the "No expenses" line), and a total row. */
export function buildUnitExpenseSheet(name: string, unitName: string, expenses: readonly ExpenseMonthRow[], monthLabel: string): SheetModel {
  const total = expenses.reduce((sum, row) => sum + row.amountCentavos, 0);
  const count = `${expenses.length} expense${expenses.length === 1 ? "" : "s"}`;
  const rows: Row[] = [
    { h: 30, cells: band(`${unitName}  ·  Expenses  ·  ${monthLabel}`, "title") },
    { h: 20, cells: band(`${count}  ·  Total ${formatPesos(total)}`, "subtitle") },
    { h: 8, cells: band("", "subtitle") },
    { h: 20, cells: [text("Date", "headFirst"), text("Category", "headText"), text("Amount", "headAmount"), text("Last replaced", "headText"), text("Notes", "headText")] },
  ];
  const merges = ["A1:E1", "A2:E2", "A3:E3"];

  if (!expenses.length) {
    rows.push({ h: 22, cells: [text(`No expenses for ${monthLabel}`, "lineLabelItalic")] });
    merges.push("A5:E5");
  }
  for (const expense of expenses) {
    const others = expense.category === "others";
    rows.push({
      cells: [
        { v: excelSerial(expense.date), s: "dateShort" },
        text(categoryText({ category: expense.category, custom_category: expense.customCategory }), "textWrap"),
        { v: pesos(expense.amountCentavos), s: "amountCents" },
        others || !expense.replacedDate ? text("N/A", "text") : { v: excelSerial(expense.replacedDate), s: "dateShort" },
        text(expense.notes, "textWrap"),
      ],
    });
  }

  const firstData = 5;
  const lastData = firstData + expenses.length - 1;
  rows.push({
    h: 20,
    cells: [
      text("Total", "grandLabel"), blank("grandLabel"),
      { v: pesos(total), s: "grandAmountCents", ...(expenses.length ? { f: `SUM(C${firstData}:C${lastData})` } : {}) },
      blank("grandLabel"), blank("grandLabel"),
    ],
  });

  return { name, tabColor, columns, rows, merges, hyperlinks: [], printTitles: true, orientation: "landscape", fitToHeight: 0 };
}

/** The sheets of the workbook, one per unit in payload order, named by Excel's rules (31 characters, no : \ / ? * [ ], duplicates numbered). */
export function* buildExpensesSheets(payload: ExpensesMonthPayload): Generator<SheetModel> {
  const names = sheetNames(payload.units.map((unit) => unit.name));
  const byUnit = new Map<string, ExpenseMonthRow[]>();
  for (const expense of payload.expenses) byUnit.set(expense.unitId, [...(byUnit.get(expense.unitId) ?? []), expense]);
  for (const [index, unit] of payload.units.entries()) yield buildUnitExpenseSheet(names[index], unit.name, byUnit.get(unit.id) ?? [], payload.monthLabel);
}

/** The .xlsx bytes for a payload. The Expenses download card calls this in the browser. */
export function buildExpensesWorkbook(payload: ExpensesMonthPayload): Promise<Uint8Array> {
  return workbookBytes(buildExpensesSheets(payload), `ROLNET expenses ${payload.monthLabel}`);
}
