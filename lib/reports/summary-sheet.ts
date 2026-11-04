import type { ReportKind } from "@/lib/reports/periods";
import { headerRows, kindLabel, type UnitTotals } from "@/lib/reports/report-layout";
import { sheetRef, type Cell, type Row, type SheetModel, type StyleName } from "@/lib/reports/xlsx";

// Feature 014 (spec Section 5, contracts/workbook-layout.md): the "All units" summary sheet. Every figure
// links to a unit sheet with a live formula and carries the cached value from the unit's own totals.

export const summaryTabColor = "1F3864";

export interface SummaryUnit {
  sheetName: string;
  /** Cells on the unit sheet for Rental, Deposit, Allowance, Expenses, Net. */
  linkRefs: [string, string, string, string, string];
  totals: UnitTotals;
}

const same = [
  "Rental and Allowance come from the remittance records (Allowance is 40 per remittance). Deposit = Rental - Allowance, whatever was paid that day.",
];
const noRemittance = "Days with no remittance (unassigned, day-off, repair) are listed with the date and blank amounts.";

/** The note lines for each report type (spec FR-043). The mocks' "MOCK DATA" line is not included. */
export const summaryNotes: Record<ReportKind, string[]> = {
  monthly: [
    "Layout: one sheet per unit (tab name = unit name) plus this All units summary. Each sheet has the month and year as its header.",
    "Dates: each row is the actual calendar date. Weekly blocks are Monday to Sunday and are labeled with their date range.",
    ...same,
    "Expenses: total from the Expenses table for that unit and week.",
    "Net = Allowance - Expenses. Subtotals, totals, and Net are live formulas. Green numbers on this sheet link to the unit sheets.",
    noRemittance,
  ],
  weekly: [
    "Layout: one sheet per unit (tab name = unit name) plus this All units summary. Each sheet has the week as its header.",
    "Dates: each row is the actual calendar date. The week runs Monday to Sunday and can cross two months.",
    ...same,
    "Expenses: total from the Expenses table for that unit and week.",
    "Net = Allowance - Expenses. Subtotals and Net are live formulas. Green numbers on this sheet link to the unit sheets.",
    noRemittance,
  ],
  yearly: [
    "Layout: one sheet per unit (tab name = unit name) plus this All units summary. Each sheet has the year as its header.",
    "Months: January to December, one row each. Months with no remittances show as -.",
    "Rental and Allowance are the month's totals from the remittance records. Deposit = Rental - Allowance.",
    "Expenses: total from the Expenses table for that unit and year.",
    "Net = Allowance - Expenses. Subtotals and Net are live formulas. Green numbers on this sheet link to the unit sheets.",
  ],
};

/** Lines longer than this wrap onto a second line in the merged note cell. */
const shortNote = 112;
const columns = ["Rental", "Deposit", "Allowance", "Expenses", "Net"] as const;
const pick = (totals: UnitTotals): number[] => [totals.rentalCentavos, totals.depositCentavos, totals.allowanceCentavos, totals.expensesCentavos, totals.netCentavos];

export function summarySheet(kind: ReportKind, periodTitle: string, units: SummaryUnit[]): SheetModel {
  const header = headerRows(periodTitle, `All units  ·  ${kindLabel[kind]} report`, ["Unit", ...columns], ["headFirst", "headAmount", "headAmount", "headAmount", "headAmount", "headAmount"]);
  const rows: Row[] = header.rows;
  const merges = [...header.merges];
  const hyperlinks: SheetModel["hyperlinks"] = [];
  const first = rows.length + 1;
  const sums = [0, 0, 0, 0, 0];
  units.forEach((unit) => {
    const r = rows.length + 1;
    hyperlinks.push({ ref: `A${r}`, sheet: unit.sheetName });
    const values = pick(unit.totals);
    values.forEach((value, index) => { sums[index] += value; });
    rows.push({ cells: [{ v: unit.sheetName, s: "link" }, ...unit.linkRefs.map((ref, index): Cell => ({ v: values[index] / 100, f: `${sheetRef(unit.sheetName)}!${ref}`, s: "linkAmount" }))] });
  });
  const last = rows.length;
  const letters = ["B", "C", "D", "E", "F"];
  rows.push({ cells: [{ v: "ALL UNITS", s: "grandLabel" }, ...sums.map((sum, index): Cell => ({ v: sum / 100, ...(units.length ? { f: `SUM(${letters[index]}${first}:${letters[index]}${last})` } : {}), s: "grandAmount" }))] });
  rows.push({ cells: [] });
  rows.push({ cells: [{ v: "Notes", s: "notesHead" }] });
  for (const line of summaryNotes[kind]) {
    const r = rows.length + 1;
    merges.push(`A${r}:F${r}`);
    const style: StyleName = "note";
    rows.push({ h: line.length <= shortNote ? 15 : 28, cells: [{ v: line, s: style }, ...Array.from({ length: 5 }, () => ({ v: null, s: style }) as Cell)] });
  }
  return { name: "All units", tabColor: summaryTabColor, columns: [26, 15, 15, 15, 15, 15], rows, merges, hyperlinks, printTitles: false };
}
