import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import type { SfDistributionDetail } from "@/lib/sinking-fund/types";
import { workbookBytes, type Cell, type Row, type SheetModel, type StyleName } from "@/lib/reports/xlsx";

// Feature 016 (contracts/excel-layout.md): one sheet for one distribution, built with the feature 014 workbook
// writer, which already sets A4, portrait, fit to one page wide and tall, and Excel's "Narrow" margins. Amounts
// arrive in centavos and are written as pesos with two decimals.

export const distributionSheetName = "Distribution";
const tabColor = "1F3864";
const notRecorded = "Not recorded";
const pesos = (centavos: number) => centavos / 100;
const text = (v: string, s: StyleName): Cell => ({ v, s });
const blank = (s: StyleName): Cell => ({ v: null, s });
const band = (first: string, style: StyleName): (Cell | undefined)[] => [text(first, style), blank(style), blank(style), blank(style)];

/** The sheet model for one distribution: header block (rows 1 to 4), one row per participant, and a totals row. */
export function buildDistributionSheet(detail: SfDistributionDetail): SheetModel {
  const { distribution, rows: people, totals } = detail;
  const title = `Sinking fund distribution ${distribution.year}${distribution.voided_at ? " (VOIDED)" : ""}`;
  const subtitle = `${formatListDate(distribution.dist_date)}  ·  ${people.length} participant${people.length === 1 ? "" : "s"}  ·  Distributed ${formatPesos(distribution.total_distributed_centavos)}  ·  Stayed in the fund ${formatPesos(distribution.remainder_centavos)}`;
  const firstData = 5;
  const lastData = firstData + people.length - 1;
  const totalRow = lastData + 1;
  const hasTotal = totals.ended_total_centavos !== null;

  const rows: Row[] = [
    { h: 30, cells: band(title, "title") },
    { h: 20, cells: band(subtitle, "subtitle") },
    {
      h: 20,
      cells: [
        text("Sinking fund total for the year", "subLabel"), blank("subLabel"), blank("subLabel"),
        hasTotal ? { v: pesos(totals.ended_total_centavos ?? 0), s: "subAmountCents", f: `C${totalRow}` } : text(notRecorded, "subLabel"),
      ],
    },
    { h: 20, cells: [text("Rank", "headFirst"), text("Participant", "headText"), text("Ended total savings", "headAmount"), text("Distributed share", "headAmount")] },
  ];

  people.forEach((person, index) => {
    rows.push({
      cells: [
        { v: index + 1, s: "text" },
        text(person.participant_name, "text"),
        person.ended_total_centavos === null ? text(notRecorded, "text") : { v: pesos(person.ended_total_centavos), s: "amountCents" },
        { v: pesos(person.share_centavos), s: "amountCents" },
      ],
    });
  });

  rows.push({
    h: 20,
    cells: [
      text("Total", "grandLabel"), blank("grandLabel"),
      hasTotal ? { v: pesos(totals.ended_total_centavos ?? 0), s: "grandAmountCents", f: `SUM(C${firstData}:C${lastData})` } : text(notRecorded, "grandLabel"),
      people.length ? { v: pesos(totals.share_centavos), s: "grandAmountCents", f: `SUM(D${firstData}:D${lastData})` } : { v: 0, s: "grandAmountCents" },
    ],
  });

  const merges = ["A1:D1", "A2:D2", "A3:C3"];
  if (distribution.notes) {
    rows.push({ h: 10, cells: [] });
    rows.push({ h: 30, cells: [text(`Notes: ${distribution.notes.slice(0, 120)}`, "note")] });
    merges.push(`A${rows.length}:D${rows.length}`);
  }

  return { name: distributionSheetName, tabColor, columns: [7, 34, 22, 20], rows, merges, hyperlinks: [], printTitles: false };
}

/** The .xlsx file for one distribution. */
export function buildDistributionWorkbook(detail: SfDistributionDetail): Promise<Uint8Array> {
  return workbookBytes([buildDistributionSheet(detail)], `Sinking fund distribution ${detail.distribution.year}`);
}

/** The download name: the year and the date, e.g. "rolnet-sinking-fund-2026-2026-11-13.xlsx". */
export function distributionFileName(distribution: Pick<SfDistributionDetail["distribution"], "year" | "dist_date">) {
  return `rolnet-sinking-fund-${distribution.year}-${distribution.dist_date}.xlsx`;
}
