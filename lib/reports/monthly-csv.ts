// Column order from specs/001-fleet-management/contracts/http.md. Values come straight from
// monthly_report() (20261029001300), including its final FLEET TOTAL row; no totals are
// recalculated here. monthly_report() returns `body_number`, which is written as
// `unit_body_number`; every other column has the same name in the function and the CSV.
export const reportColumns = [
  "month", "unit_body_number", "plate_number", "remittance_due_centavos", "remittance_paid_centavos",
  "outstanding_centavos", "credit_centavos", "fuel_expense_centavos", "repair_expense_centavos",
  "registration_expense_centavos", "insurance_expense_centavos", "other_expense_centavos",
  "total_expense_centavos", "net_income_centavos",
] as const;

const textColumns: Partial<Record<(typeof reportColumns)[number], string>> = { unit_body_number: "body_number", plate_number: "plate_number" };

/**
 * Spreadsheets run a cell that starts with = + - @ (or a tab/carriage return) as a formula
 * (CSV injection, FR-029/SC-009). Such text gets a leading apostrophe. Whole numbers, including
 * a negative net income, are left as numbers.
 */
export function neutraliseFormula(value: string) {
  if (/^-?\d+$/.test(value)) return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function escapeCsv(value: unknown) {
  const text = neutraliseFormula(String(value ?? ""));
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function cell(month: string, row: Record<string, unknown>, column: (typeof reportColumns)[number]) {
  if (column === "month") return month;
  const textColumn = textColumns[column];
  if (textColumn) return row[textColumn] ?? "";
  return row[column] ?? 0;
}

export function monthlyCsv(month: string, rows: Record<string, unknown>[]) {
  const lines = [reportColumns.join(","), ...rows.map((row) => reportColumns.map((column) => escapeCsv(cell(month, row, column))).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

const amountColumnCount = reportColumns.length - 3;

function dataLines(csv: string) {
  return csv.replace(/^﻿/, "").split("\r\n").slice(1).filter(Boolean);
}

/** Unit rows in a downloaded CSV: every data row except the FLEET TOTAL row (T142 feedback). */
export function countUnitRows(csv: string) {
  return dataLines(csv).filter((line) => !line.includes(",FLEET TOTAL,")).length;
}

/**
 * True when any amount in the CSV is not zero. Amounts are the last 11 columns; only the text
 * columns before them can be quoted (and so contain commas), so they are counted from the end.
 */
export function reportHasActivity(csv: string) {
  return dataLines(csv).some((line) => line.split(",").slice(-amountColumnCount).some((value) => value !== "" && value !== "0"));
}
