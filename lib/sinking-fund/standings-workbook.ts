import { formatPesos } from "@/lib/money/centavos";
import { monthNames } from "@/lib/reports/periods";
import { workbookBytes, type Cell, type Row, type SheetModel, type StyleName } from "@/lib/reports/xlsx";
import { formatListDate } from "@/lib/sinking-fund/format";
import { rankRows } from "@/lib/sinking-fund/rankings";
import type { SfStandingRow } from "@/lib/sinking-fund/types";

// Feature 019 (contracts/sinking-fund-standings.md): one sheet, the monthly standings, built with the feature 014
// workbook writer: A4 portrait, Narrow margins, one page wide. Amounts arrive in centavos and are written as pesos
// with two decimals, as in the distribution workbook. The ranking is the Top participants view's (rankRows), so ties
// share a rank and then go by name, and a participant with no savings is listed last with no rank number.

export const standingsSheetName = "Standings";
const tabColor = "1F3864";
const columns = [7, 34, 20, 20, 24];
/** Above this many participants the sheet may run over more pages tall so the text keeps its size. */
const onePageRows = 45;
const pesos = (centavos: number) => centavos / 100;
const text = (v: string, s: StyleName): Cell => ({ v, s });
const blank = (s: StyleName): Cell => ({ v: null, s });
const band = (first: string, style: StyleName): (Cell | undefined)[] => [text(first, style), ...Array.from({ length: columns.length - 1 }, () => blank(style))];

export interface StandingsOptions {
  /** YYYY-MM of the chosen month. */
  month: string;
  /** The date the figures are as of: the month's last day, or today for the current month. */
  asOf: string;
  isCurrentMonth: boolean;
}

export function standingsMonthLabel(month: string) {
  return `${monthNames[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** The sheet model: header block (rows 1 to 4), one row per participant in rank order, and a totals row. */
export function buildStandingsSheet(standings: readonly SfStandingRow[], { month, asOf, isCurrentMonth }: StandingsOptions): SheetModel {
  const byId = new Map(standings.map((row) => [row.participant_id, row]));
  const ranked = rankRows(standings.map((row) => ({ participant_id: row.participant_id, name: row.name, driver_id: null, amount_centavos: row.savings_centavos })));
  const total = (pick: (row: SfStandingRow) => number) => standings.reduce((sum, row) => sum + pick(row), 0);
  const title = `Sinking fund standings  ·  ${standingsMonthLabel(month)}${isCurrentMonth ? `  ·  as of ${formatListDate(asOf)}` : ""}`;
  const subtitle = `${standings.length} participant${standings.length === 1 ? "" : "s"}  ·  Total savings ${formatPesos(total((row) => row.savings_centavos))}  ·  Unpaid loans ${formatPesos(total((row) => row.balance_to_pay_centavos))}`;
  const firstData = 5;
  const lastData = firstData + ranked.length - 1;

  const rows: Row[] = [
    { h: 30, cells: band(title, "title") },
    { h: 20, cells: band(subtitle, "subtitle") },
    { h: 18, cells: band("Overdue balances are shaded and marked \"Overdue\".", "note") },
    { h: 20, cells: [text("Rank", "headFirst"), text("Participant", "headText"), text("Total savings", "headAmount"), text("Total loans", "headAmount"), text("Unpaid balance", "headAmount")] },
  ];

  for (const entry of ranked) {
    const row = byId.get(entry.participant_id)!;
    rows.push({
      cells: [
        entry.rank > 0 ? { v: entry.rank, s: "text" } : blank("text"),
        text(row.name, "text"),
        { v: pesos(row.savings_centavos), s: "amountCents" },
        { v: pesos(row.loans_centavos), s: "amountCents" },
        { v: pesos(row.balance_to_pay_centavos), s: row.has_overdue ? "overdueAmountCents" : "amountCents" },
      ],
    });
  }

  const sum = (column: string, value: number): Cell => ({ v: pesos(value), s: "grandAmountCents", ...(ranked.length ? { f: `SUM(${column}${firstData}:${column}${lastData})` } : {}) });
  rows.push({
    h: 20,
    cells: [
      text("Total", "grandLabel"), blank("grandLabel"),
      sum("C", total((row) => row.savings_centavos)),
      sum("D", total((row) => row.loans_centavos)),
      sum("E", total((row) => row.balance_to_pay_centavos)),
    ],
  });

  return {
    name: standingsSheetName,
    tabColor,
    columns,
    rows,
    merges: ["A1:E1", "A2:E2", "A3:E3"],
    hyperlinks: [],
    printTitles: true,
    orientation: "portrait",
    fitToHeight: ranked.length > onePageRows ? 0 : 1,
  };
}

/** The .xlsx file for one month's standings. */
export function buildStandingsWorkbook(standings: readonly SfStandingRow[], options: StandingsOptions): Promise<Uint8Array> {
  return workbookBytes([buildStandingsSheet(standings, options)], `Sinking fund standings ${standingsMonthLabel(options.month)}`);
}

/** The download name: "rolnet-sinking-fund-standings-2026-11.xlsx". */
export function standingsFileName(month: string) {
  return `rolnet-sinking-fund-standings-${month}.xlsx`;
}
