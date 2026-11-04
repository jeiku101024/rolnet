import { days, excelSerial, monthTitle, monthWeeks, rangeLabel, weekRange, weekTitle, type DateRange, type ReportKind } from "@/lib/reports/periods";
import type { Cell, Row, SheetModel, StyleName } from "@/lib/reports/xlsx";

// Feature 014 (contracts/workbook-layout.md): the unit sheets of the Weekly, Monthly and Yearly reports as
// sheet models. Amounts arrive in centavos and are written as pesos; every total is a live formula with its
// cached value, worked out here from the same centavo sums. Row numbers come from the build, never from
// constants, and each builder returns the cells the All units summary links to.

export interface ReportRemittance { date: string; rentalCentavos: number; allowanceCentavos: number; driverName: string }
export interface UnitDailyData { remittances: ReportRemittance[]; expensesByDate: Map<string, number> }
export interface UnitYearData { months: { rentalCentavos: number; allowanceCentavos: number }[]; expenseCentavos: number }

export interface UnitTotals { rentalCentavos: number; depositCentavos: number; allowanceCentavos: number; expensesCentavos: number; netCentavos: number }
/** A finished unit sheet and where the summary links to: Rental, Deposit, Allowance, Expenses, Net. */
export interface UnitSheet { sheet: SheetModel; linkRefs: [string, string, string, string, string]; totals: UnitTotals }

export const kindLabel: Record<ReportKind, string> = { weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

export const unitTabColor = "2F5496";
const dailyHeights = { monthly: 13, weekly: 16 } as const;

const pesos = (centavos: number) => centavos / 100;
const text = (v: string, s: StyleName): Cell => ({ v, s });
const blank = (s: StyleName): Cell => ({ v: null, s });
const amount = (centavos: number, s: StyleName, f?: string): Cell => (f === undefined ? { v: pesos(centavos), s } : { v: pesos(centavos), s, f });

/** Rows 1 to 4: title band, second line, spacer, and column headers (research R11). */
export function headerRows(title: string, subtitle: string, headers: string[], styles: StyleName[]): { rows: Row[]; merges: string[] } {
  const width = headers.length;
  const last = String.fromCharCode(64 + width);
  const band = (first: string, style: StyleName): (Cell | undefined)[] => Array.from({ length: width }, (_, index) => (index === 0 ? text(first, style) : blank(style)));
  return {
    rows: [
      { h: 30, cells: band(title, "title") },
      { h: 20, cells: band(subtitle, "subtitle") },
      { h: 10, cells: [] },
      { h: 20, cells: headers.map((label, index) => text(label, styles[index])) },
    ],
    merges: [`A1:${last}1`, `A2:${last}2`],
  };
}

function groupByDate(remittances: ReportRemittance[]) {
  const map = new Map<string, ReportRemittance[]>();
  for (const row of remittances) map.set(row.date, [...(map.get(row.date) ?? []), row]);
  return map;
}

interface Block { subtotalRow: number; expensesRow: number; rentalCentavos: number; allowanceCentavos: number; expensesCentavos: number }

/** One block: its date rows, then Subtotal, Expenses, Allowance and Net (spec FR-051, FR-062). */
function dailyBlock(rows: Row[], height: number, dates: string[], byDate: Map<string, ReportRemittance[]>, expensesCentavos: number, label: string): Block {
  const first = rows.length + 1;
  let rental = 0;
  let allowance = 0;
  const row = (cells: (Cell | undefined)[]) => rows.push({ h: height, cells });
  for (const date of dates) {
    const onDay = byDate.get(date) ?? [];
    if (!onDay.length) row([{ v: excelSerial(date), s: "date" }, blank("text"), blank("amount"), blank("amount"), blank("amount")]);
    for (const item of onDay) {
      const r = rows.length + 1;
      rental += item.rentalCentavos;
      allowance += item.allowanceCentavos;
      row([{ v: excelSerial(date), s: "date" }, text(item.driverName, "text"), amount(item.rentalCentavos, "amount"), amount(item.rentalCentavos - item.allowanceCentavos, "amount", `C${r}-E${r}`), amount(item.allowanceCentavos, "amount")]);
    }
  }
  const last = rows.length;
  const s = last + 1;
  const sum = (column: string) => `SUM(${column}${first}:${column}${last})`;
  row([text(label, "subLabel"), blank("subAmount"), amount(rental, "subAmount", sum("C")), amount(rental - allowance, "subAmount", sum("D")), amount(allowance, "subAmount", sum("E"))]);
  row([text("Expenses:", "lineLabelItalic"), undefined, amount(expensesCentavos, "lineAmountItalic")]);
  row([text("Allowance:", "lineLabelItalic"), undefined, amount(allowance, "lineAmountItalic", `E${s}`)]);
  row([text("Net:", "lineLabelBold"), undefined, amount(allowance - expensesCentavos, "lineAmountBold", `C${s + 2}-C${s + 1}`)]);
  return { subtotalRow: s, expensesRow: s + 1, rentalCentavos: rental, allowanceCentavos: allowance, expensesCentavos };
}

const sumExpenses = (map: Map<string, number>, dates: string[]) => dates.reduce((total, date) => total + (map.get(date) ?? 0), 0);
const dailyColumns = [36, 24, 17, 17, 17];
const dailyHeaders = ["Date", "Driver", "Rental", "Deposit", "Allowance"];
const dailyHeaderStyles: StyleName[] = ["headFirst", "headText", "headAmount", "headAmount", "headAmount"];

function dailySheet(sheetName: string, rows: Row[], merges: string[]): SheetModel {
  return { name: sheetName, tabColor: unitTabColor, columns: dailyColumns, rows, merges, hyperlinks: [], printTitles: true };
}

/** The Monthly unit sheet (spec Section 6): week blocks from Monday to Sunday, then the GRAND TOTAL block. */
export function monthlyUnitSheet(sheetName: string, unitName: string, data: UnitDailyData, month: string): UnitSheet {
  const header = headerRows(monthTitle(month), `Unit ${unitName}  ·  Monthly report`, dailyHeaders, dailyHeaderStyles);
  const rows = header.rows;
  const byDate = groupByDate(data.remittances);
  const blocks = monthWeeks(month).map((week, index) => {
    const dates = days({ from: week.from, to: week.to }).map((day) => day.date);
    return dailyBlock(rows, dailyHeights.monthly, dates, byDate, sumExpenses(data.expensesByDate, dates), `Week ${index + 1} Subtotal  ·  ${rangeLabel(week.from, week.to)}`);
  });
  const g = rows.length + 1;
  const total = (pick: (block: Block) => number) => blocks.reduce((sum, block) => sum + pick(block), 0);
  const rental = total((block) => block.rentalCentavos);
  const allowance = total((block) => block.allowanceCentavos);
  const expenses = total((block) => block.expensesCentavos);
  const join = (column: string, row: (block: Block) => number) => blocks.map((block) => `${column}${row(block)}`).join("+");
  const row = (cells: (Cell | undefined)[]) => rows.push({ h: dailyHeights.monthly, cells });
  row([text("GRAND TOTAL", "grandLabel"), blank("grandAmount"), amount(rental, "grandAmount", join("C", (b) => b.subtotalRow)), amount(rental - allowance, "grandAmount", join("D", (b) => b.subtotalRow)), amount(allowance, "grandAmount", join("E", (b) => b.subtotalRow))]);
  row([text("Expenses:", "grandLineLabelItalic"), undefined, amount(expenses, "grandLineAmountItalic", join("C", (b) => b.expensesRow))]);
  row([text("Allowance:", "grandLineLabelItalic"), undefined, amount(allowance, "grandLineAmountItalic", `E${g}`)]);
  row([text("Net:", "lineLabelBold"), undefined, amount(allowance - expenses, "lineAmountBold", `C${g + 2}-C${g + 1}`)]);
  return {
    sheet: dailySheet(sheetName, rows, header.merges),
    linkRefs: [`C${g}`, `D${g}`, `E${g}`, `C${g + 1}`, `C${g + 3}`],
    totals: { rentalCentavos: rental, depositCentavos: rental - allowance, allowanceCentavos: allowance, expensesCentavos: expenses, netCentavos: allowance - expenses },
  };
}

/** The Weekly unit sheet (spec Section 7): the seven days, then one block and no GRAND TOTAL. */
export function weeklyUnitSheet(sheetName: string, unitName: string, data: UnitDailyData, monday: string): UnitSheet {
  const range: DateRange = weekRange(monday);
  const header = headerRows(weekTitle(range.from), `Unit ${unitName}  ·  Weekly report`, dailyHeaders, dailyHeaderStyles);
  const rows = header.rows;
  const dates = days(range).map((day) => day.date);
  const block = dailyBlock(rows, dailyHeights.weekly, dates, groupByDate(data.remittances), sumExpenses(data.expensesByDate, dates), `Week Subtotal  ·  ${rangeLabel(range.from, range.to)}`);
  const s = block.subtotalRow;
  const { rentalCentavos: rental, allowanceCentavos: allowance, expensesCentavos: expenses } = block;
  return {
    sheet: dailySheet(sheetName, rows, header.merges),
    linkRefs: [`C${s}`, `D${s}`, `E${s}`, `C${s + 1}`, `C${s + 3}`],
    totals: { rentalCentavos: rental, depositCentavos: rental - allowance, allowanceCentavos: allowance, expensesCentavos: expenses, netCentavos: allowance - expenses },
  };
}

/** The Yearly unit sheet (spec Section 8): twelve month rows, Year Subtotal block, then the GRAND TOTAL block. */
export function yearlyUnitSheet(sheetName: string, unitName: string, data: UnitYearData, year: number): UnitSheet {
  const header = headerRows(String(year), `Unit ${unitName}  ·  Yearly report`, ["Month", "Rental", "Deposit", "Allowance"], ["headFirst", "headAmount", "headAmount", "headAmount"]);
  const rows = header.rows;
  const row = (cells: (Cell | undefined)[]) => rows.push({ h: 16, cells });
  let rental = 0;
  let allowance = 0;
  data.months.forEach((month, index) => {
    const r = rows.length + 1;
    rental += month.rentalCentavos;
    allowance += month.allowanceCentavos;
    row([{ v: excelSerial(`${year}-${String(index + 1).padStart(2, "0")}-01`), s: "month" }, amount(month.rentalCentavos, "amount"), amount(month.rentalCentavos - month.allowanceCentavos, "amount", `B${r}-D${r}`), amount(month.allowanceCentavos, "amount")]);
  });
  const expenses = data.expenseCentavos;
  const sub = rows.length + 1;
  const net = allowance - expenses;
  row([text("Year Subtotal  ·  Jan–Dec", "subLabel"), amount(rental, "subAmount", `SUM(B5:B${sub - 1})`), amount(rental - allowance, "subAmount", `SUM(C5:C${sub - 1})`), amount(allowance, "subAmount", `SUM(D5:D${sub - 1})`)]);
  row([text("Expenses:", "lineLabelItalic"), amount(expenses, "lineAmountItalic")]);
  row([text("Allowance:", "lineLabelItalic"), amount(allowance, "lineAmountItalic", `D${sub}`)]);
  row([text("Net:", "lineLabelBold"), amount(net, "lineAmountBold", `B${sub + 2}-B${sub + 1}`)]);
  const g = rows.length + 1;
  row([text("GRAND TOTAL", "grandLabel"), amount(rental, "grandAmount", `B${sub}`), amount(rental - allowance, "grandAmount", `C${sub}`), amount(allowance, "grandAmount", `D${sub}`)]);
  row([text("Expenses:", "grandLineLabelItalic"), amount(expenses, "grandLineAmountItalic", `B${sub + 1}`)]);
  row([text("Allowance:", "grandLineLabelItalic"), amount(allowance, "grandLineAmountItalic", `D${g}`)]);
  row([text("Net:", "lineLabelBold"), amount(net, "lineAmountBold", `B${g + 2}-B${g + 1}`)]);
  return {
    sheet: { name: sheetName, tabColor: unitTabColor, columns: [30, 24, 24, 24], rows, merges: header.merges, hyperlinks: [], printTitles: true },
    linkRefs: [`B${g}`, `C${g}`, `D${g}`, `B${g + 1}`, `B${g + 3}`],
    totals: { rentalCentavos: rental, depositCentavos: rental - allowance, allowanceCentavos: allowance, expensesCentavos: expenses, netCentavos: net },
  };
}
