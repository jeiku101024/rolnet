import { describe, expect, it } from "vitest";
import { buildStandingsSheet, buildStandingsWorkbook, standingsFileName } from "@/lib/sinking-fund/standings-workbook";
import type { SfStandingRow } from "@/lib/sinking-fund/types";
import { sheetXml, StyleRegistry } from "@/lib/reports/xlsx";
import { readWorkbook } from "@/tests/support/xlsx-read";

const standing = (name: string, savings: number, loans = 0, balance = 0, overdue = false): SfStandingRow => ({ participant_id: name, name, savings_centavos: savings, loans_centavos: loans, balance_to_pay_centavos: balance, has_overdue: overdue });
const rows = [standing("Cy", 50000), standing("Ana", 200000, 100000, 105000, true), standing("Bo", 200000), standing("Zed", 0)];
const options = { month: "2026-10", asOf: "2026-10-31", isCurrentMonth: false };

describe("standings sheet (feature 019)", () => {
  const sheet = buildStandingsSheet(rows, options);
  const cell = (row: number, column: number) => sheet.rows[row - 1].cells[column];

  it("has the title band with the month and the five columns in order", () => {
    expect(cell(1, 0)?.v).toBe("Sinking fund standings  ·  October 2026");
    expect([0, 1, 2, 3, 4].map((column) => cell(4, column)?.v)).toEqual(["Rank", "Participant", "Total savings", "Total loans", "Unpaid balance"]);
  });

  it("adds the as-of date for the current month only", () => {
    expect(buildStandingsSheet(rows, { month: "2026-11", asOf: "2026-11-19", isCurrentMonth: true }).rows[0].cells[0]?.v).toBe("Sinking fund standings  ·  November 2026  ·  as of Nov 19, 2026");
  });

  it("ranks by savings with ties sharing a rank and ordered by name, and no rank for no savings", () => {
    expect([5, 6, 7, 8].map((row) => [cell(row, 0)?.v ?? null, cell(row, 1)?.v])).toEqual([[1, "Ana"], [1, "Bo"], [3, "Cy"], [null, "Zed"]]);
  });

  it("writes pesos with two decimals and marks an overdue balance while keeping it a number", () => {
    expect(cell(5, 2)).toMatchObject({ v: 2000, s: "amountCents" });
    expect(cell(5, 4)).toMatchObject({ v: 1050, s: "overdueAmountCents" });
    expect(cell(6, 4)).toMatchObject({ v: 0, s: "amountCents" });
  });

  it("ends with a totals row of live sums", () => {
    expect([2, 3, 4].map((column) => [cell(9, column)?.f, cell(9, column)?.v])).toEqual([["SUM(C5:C8)", 4500], ["SUM(D5:D8)", 1000], ["SUM(E5:E8)", 1050]]);
  });

  it("prints A4 portrait with Narrow margins, one page wide, and repeats the header rows", () => {
    const xml = sheetXml(sheet, new StyleRegistry());
    expect(xml).toContain('paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"');
    expect(xml).toContain('<pageMargins left="0.25" right="0.25" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>');
    expect(sheet.printTitles).toBe(true);
  });

  it("lets a long list run over more pages tall so it is still one page wide", () => {
    const many = Array.from({ length: 46 }, (_, index) => standing(`P${index}`, index * 100));
    expect(buildStandingsSheet(many, options).fitToHeight).toBe(0);
    expect(buildStandingsSheet(many.slice(0, 45), options).fitToHeight).toBe(1);
  });

  it("writes a valid workbook with one sheet and the dated file name", async () => {
    const workbook = readWorkbook(await buildStandingsWorkbook(rows, options));
    expect(workbook.sheets.map((item) => item.name)).toEqual(["Standings"]);
    expect(standingsFileName("2026-10")).toBe("rolnet-sinking-fund-standings-2026-10.xlsx");
  });

  it("handles an empty fund without a broken sum", () => {
    const empty = buildStandingsSheet([], options);
    expect(empty.rows.at(-1)!.cells[2]).toMatchObject({ v: 0 });
    expect(empty.rows.at(-1)!.cells[2]?.f).toBeUndefined();
  });
});
