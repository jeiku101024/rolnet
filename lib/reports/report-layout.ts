import { days, monthLabels, monthWeeks, weekRange, weeklyLabel, yearRange, type ReportDay } from "@/lib/reports/periods";
import { fitColumns, type Cell, type NumberFormat, type Sheet, type StyleKey } from "@/lib/reports/xlsx";

// Feature 009 (contracts/report-sheets.md): the Weekly, Monthly and Yearly sheets. Amounts arrive in
// centavos and are written as pesos; every total is a live formula with its cached value.

export interface ReportRemittance { service_date: string; rentalCentavos: number; allowanceCentavos: number; depositCentavos: number; driverName: string }
export interface ReportData { remittances: ReportRemittance[]; expensesByDate: Map<string, number> }

const weekHeaders = ["Week", "Day", "Driver", "Rental", "Deposit", "Allowance", "Month", "Year"];
const weekMinimums = [7, 16, 18, 12, 12, 12, 8, 8];
const yearHeaders = ["Year", "Month", "Rental", "Deposit", "Allowance"];
const yearMinimums = [8, 16, 12, 12, 12];

const header = (labels: string[]): Cell[] => labels.map((value) => ({ value, style: "header" }));
const text = (value: string | number | null, style: StyleKey): Cell => ({ value, style });

/** A peso amount from centavos, with centavos shown only when it has them. */
function money(centavos: number, style: StyleKey, yearly = false, formula?: string): Cell {
  const fractional = centavos % 100 !== 0;
  const format: NumberFormat = yearly ? (fractional ? "yearDecimal" : "yearWhole") : fractional ? "decimal" : "whole";
  return { value: centavos / 100, formula, style, format };
}

/** A row the width of the sheet, every cell in one style (for borders and fills across it). */
function band(width: number, style: StyleKey, cells: Record<number, Cell>): Cell[] {
  return Array.from({ length: width }, (_, index) => cells[index] ?? text(null, style));
}

function sheetName(kind: string, unitName?: string) {
  return unitName ? `${kind} - ${unitName}` : kind;
}

function byDate(data: ReportData) {
  const map = new Map<string, ReportRemittance[]>();
  for (const row of data.remittances) map.set(row.service_date, [...(map.get(row.service_date) ?? []), row]);
  return map;
}

interface WeekBlock { subtotalRow: number; expensesRow: number; rental: number; deposit: number; allowance: number; expenses: number }

/** One week's day rows, then Subtotal, Expenses, Allowance and Net (FR-025, FR-028). */
function writeWeek(rows: Cell[][], week: number, weekDays: ReportDay[], remittances: Map<string, ReportRemittance[]>, expensesByDate: Map<string, number>): WeekBlock {
  const first = rows.length + 1;
  const totals = { rental: 0, deposit: 0, allowance: 0, expenses: 0 };
  for (const day of weekDays) {
    totals.expenses += expensesByDate.get(day.date) ?? 0;
    const tail = [text(day.monthLabel, "bodyGreen"), text(day.year, "bodyGreen")];
    const onDay = remittances.get(day.date) ?? [];
    if (!onDay.length) rows.push([text(week, "body"), text(day.dayLabel, "body"), text(null, "body"), text(null, "body"), text(null, "body"), text(null, "body"), ...tail]);
    for (const row of onDay) {
      totals.rental += row.rentalCentavos;
      totals.deposit += row.depositCentavos;
      totals.allowance += row.allowanceCentavos;
      rows.push([text(week, "body"), text(day.dayLabel, "body"), text(row.driverName, "body"), money(row.rentalCentavos, "body"), money(row.depositCentavos, "body"), money(row.allowanceCentavos, "body"), ...tail]);
    }
  }
  const last = rows.length;
  const subtotalRow = last + 1;
  rows.push(band(8, "subtotal", {
    1: text(`Week ${week} Subtotal`, "subtotal"),
    3: money(totals.rental, "subtotal", false, `SUM(D${first}:D${last})`),
    4: money(totals.deposit, "subtotal", false, `SUM(E${first}:E${last})`),
    5: money(totals.allowance, "subtotal", false, `SUM(F${first}:F${last})`),
  }));
  const expensesRow = subtotalRow + 1;
  rows.push([text(null, "italicLine"), text("Expenses:", "italicLine"), text(null, "italicLine"), money(totals.expenses, "italicLine")]);
  const allowanceRow = expensesRow + 1;
  rows.push([text(null, "italicLine"), text("Allowance:", "italicLine"), text(null, "italicLine"), money(totals.allowance, "italicLine", false, `F${subtotalRow}`)]);
  rows.push([text(null, "netLine"), text("Net:", "netLine"), text(null, "netLine"), money(totals.allowance - totals.expenses, "netLine", false, `D${allowanceRow}-D${expensesRow}`)]);
  return { subtotalRow, expensesRow, ...totals };
}

/** Monday to Sunday of the week holding `monday`, as one block with no grand total (FR-030). */
export function weeklySheet(data: ReportData, monday: string, unitName?: string): Sheet {
  const rows: Cell[][] = [header(weekHeaders)];
  writeWeek(rows, weeklyLabel(monday), days(weekRange(monday)), byDate(data), data.expensesByDate);
  return { name: sheetName("Weekly", unitName), columns: fitColumns(rows, weekMinimums), rows };
}

/** Every week of the month (cut at its edges), then the GRAND TOTAL block (FR-027, FR-029). */
export function monthlySheet(data: ReportData, month: string, unitName?: string): Sheet {
  const rows: Cell[][] = [header(weekHeaders)];
  const remittances = byDate(data);
  const blocks = monthWeeks(month).map((week) => writeWeek(rows, week.week, days(week), remittances, data.expensesByDate));
  const sum = (key: "rental" | "deposit" | "allowance" | "expenses") => blocks.reduce((total, block) => total + block[key], 0);
  const refs = (column: string, key: "subtotalRow" | "expensesRow") => blocks.map((block) => `${column}${block[key]}`).join("+");
  const grandRow = rows.length + 1;
  rows.push(band(8, "grandTop", {
    1: text("GRAND TOTAL", "grandTop"),
    3: money(sum("rental"), "grandTop", false, refs("D", "subtotalRow")),
    4: money(sum("deposit"), "grandTop", false, refs("E", "subtotalRow")),
    5: money(sum("allowance"), "grandTop", false, refs("F", "subtotalRow")),
  }));
  const expensesRow = grandRow + 1;
  rows.push([text(null, "grandItalic"), text("Expenses:", "grandItalic"), text(null, "grandItalic"), money(sum("expenses"), "grandItalic", false, refs("D", "expensesRow"))]);
  const allowanceRow = expensesRow + 1;
  rows.push([text(null, "grandItalic"), text("Allowance:", "grandItalic"), text(null, "grandItalic"), money(sum("allowance"), "grandItalic", false, `F${grandRow}`)]);
  rows.push(band(8, "grandBottom", { 1: text("Net:", "grandBottom"), 3: money(sum("allowance") - sum("expenses"), "grandBottom", false, `D${allowanceRow}-D${expensesRow}`) }));
  return { name: sheetName("Monthly", unitName), columns: fitColumns(rows, weekMinimums), rows };
}

/** Twelve monthly totals, a Year Subtotal with its lines, then the GRAND TOTAL block (FR-031, FR-032). */
export function yearlySheet(data: ReportData, year: number, unitName?: string): Sheet {
  const rows: Cell[][] = [header(yearHeaders)];
  const months = monthLabels.map(() => ({ rental: 0, deposit: 0, allowance: 0 }));
  for (const row of data.remittances) {
    const month = months[Number(row.service_date.slice(5, 7)) - 1];
    month.rental += row.rentalCentavos;
    month.deposit += row.depositCentavos;
    month.allowance += row.allowanceCentavos;
  }
  const { from, to } = yearRange(year);
  let expenses = 0;
  for (const [date, centavos] of data.expensesByDate) if (date >= from && date <= to) expenses += centavos;
  months.forEach((month, index) => rows.push([text(year, "bodyGreen"), text(monthLabels[index], "bodyGreen"), money(month.rental, "body", true), money(month.deposit, "body", true), money(month.allowance, "body", true)]));
  const total = (key: "rental" | "deposit" | "allowance") => months.reduce((sum, month) => sum + month[key], 0);
  rows.push(band(5, "subtotal", {
    1: text("Year Subtotal", "subtotal"),
    2: money(total("rental"), "subtotal", true, "SUM(C2:C13)"),
    3: money(total("deposit"), "subtotal", true, "SUM(D2:D13)"),
    4: money(total("allowance"), "subtotal", true, "SUM(E2:E13)"),
  }));
  rows.push([text(null, "italicLine"), text("Expenses:", "italicLine"), money(expenses, "italicLine", true)]);
  rows.push([text(null, "italicLine"), text("Allowance:", "italicLine"), money(total("allowance"), "italicLine", true, "E14")]);
  rows.push([text(null, "netLine"), text("Net:", "netLine"), money(total("allowance") - expenses, "netLine", true, "C16-C15")]);
  rows.push(band(5, "grandTop", {
    1: text("GRAND TOTAL", "grandTop"),
    2: money(total("rental"), "grandTop", true, "C14"),
    3: money(total("deposit"), "grandTop", true, "D14"),
    4: money(total("allowance"), "grandTop", true, "E14"),
  }));
  rows.push([text(null, "grandItalic"), text("Expenses:", "grandItalic"), money(expenses, "grandItalic", true, "C15")]);
  rows.push([text(null, "grandItalic"), text("Allowance:", "grandItalic"), money(total("allowance"), "grandItalic", true, "E18")]);
  rows.push(band(5, "grandBottom", { 1: text("Net:", "grandBottom"), 2: money(total("allowance") - expenses, "grandBottom", true, "C20-C19") }));
  return { name: sheetName("Yearly", unitName), columns: fitColumns(rows, yearMinimums), rows };
}
