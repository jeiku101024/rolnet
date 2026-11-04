import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildReportSheets } from "@/lib/reports/build-report";
import type { ReportKind } from "@/lib/reports/periods";
import type { UnitDailyData, UnitYearData } from "@/lib/reports/report-layout";
import { sortUnits } from "@/lib/reports/sheet-names";
import { workbookBytes } from "@/lib/reports/xlsx";
import type { MockData } from "@/tests/support/extract-mock-data";
import { fixtureDir } from "@/tests/support/extract-mock-data";
import { readWorkbook, type ReadCell, type ReadSheet, type ResolvedStyle } from "@/tests/support/xlsx-read";

// Feature 014 (research R14): the generated workbooks must equal the client's six mocks. Sheets are matched by
// name and summary rows by unit name, because the mocks' sample tab order (DHDMM1, DHDMM2, DRECB2, DKQLM3,
// DNPTV4) is not the natural order the generator uses. Every difference is collected so one run shows them all.

const mockData = JSON.parse(readFileSync(`${fixtureDir}mock-data.json`, "utf8")) as MockData;
const readMock = (file: string) => readWorkbook(new Uint8Array(readFileSync(`${fixtureDir}${file}`)));

const stripQuotes = (formula: string | null) => (formula === null ? null : formula.replace(/'((?:[^']|'')+)'!/g, (_, name: string) => `${name.replace(/''/g, "'")}!`));
const color = (value: string | null) => (value === null || value === "theme:1" ? "000000" : value);
const border = (value: string | null) => (value === null ? null : value.replace(":auto", ":000000"));

function effective(cell: ReadCell) {
  const style: ResolvedStyle = cell.style;
  return {
    font: cell.value === null ? null : { name: style.fontName, size: style.size, bold: style.bold, italic: style.italic, underline: style.underline, color: color(style.color) },
    fill: style.fill,
    top: border(style.top),
    bottom: border(style.bottom),
    horizontal: cell.value === null ? null : style.horizontal ?? (typeof cell.value === "number" ? "right" : "left"),
    vertical: style.vertical ?? "bottom",
    indent: style.indent,
    wrap: style.wrap,
    numFmt: cell.value === null ? null : style.numFmt,
  };
}

const interesting = (cell: ReadCell) => cell.value !== null || cell.formula !== null || cell.style.fill !== null || cell.style.top !== null || cell.style.bottom !== null;

function compareCell(label: string, actual: ReadCell | undefined, expected: ReadCell, out: string[], skipText = false) {
  if (!actual) { out.push(`${label}: missing`); return; }
  if (!skipText && actual.value !== expected.value && !(typeof actual.value === "number" && typeof expected.value === "number" && Math.abs(actual.value - expected.value) < 1e-9)) out.push(`${label}: value ${JSON.stringify(actual.value)} ≠ ${JSON.stringify(expected.value)}`);
  if (!skipText && stripQuotes(actual.formula) !== stripQuotes(expected.formula)) out.push(`${label}: formula ${actual.formula} ≠ ${expected.formula}`);
  const a = effective(actual);
  const e = effective(expected);
  for (const key of Object.keys(e) as (keyof typeof e)[]) {
    if (JSON.stringify(a[key]) !== JSON.stringify(e[key])) out.push(`${label}: ${key} ${JSON.stringify(a[key])} ≠ ${JSON.stringify(e[key])}`);
  }
}

function comparePage(actual: ReadSheet, expected: ReadSheet, out: string[]) {
  const at = actual.name;
  if (actual.tabColor !== expected.tabColor) out.push(`${at}: tab ${actual.tabColor} ≠ ${expected.tabColor}`);
  if (JSON.stringify([...actual.widths]) !== JSON.stringify([...expected.widths])) out.push(`${at}: widths ${JSON.stringify([...actual.widths])} ≠ ${JSON.stringify([...expected.widths])}`);
  if (JSON.stringify(actual.freeze) !== JSON.stringify(expected.freeze)) out.push(`${at}: freeze ${JSON.stringify(actual.freeze)} ≠ ${JSON.stringify(expected.freeze)}`);
  if (JSON.stringify(actual.margins) !== JSON.stringify(expected.margins)) out.push(`${at}: margins ${JSON.stringify(actual.margins)} ≠ ${JSON.stringify(expected.margins)}`);
  for (const key of ["paperSize", "orientation", "fitToWidth", "fitToHeight"]) if (actual.pageSetup?.[key] !== expected.pageSetup?.[key]) out.push(`${at}: pageSetup.${key} ${actual.pageSetup?.[key]} ≠ ${expected.pageSetup?.[key]}`);
  if (!actual.fitToPage || !expected.fitToPage) out.push(`${at}: fitToPage`);
  const centered = (sheet: ReadSheet) => sheet.printOptions?.horizontalCentered === "1" || sheet.printOptions?.horizontalCentered === "true";
  if (!centered(actual) || !centered(expected)) out.push(`${at}: horizontalCentered`);
  if (stripQuotes(actual.printTitles) !== stripQuotes(expected.printTitles)) out.push(`${at}: printTitles ${actual.printTitles} ≠ ${expected.printTitles}`);
}

function compareHeights(actual: ReadSheet, expected: ReadSheet, out: string[], rowMap: (row: number) => number = (row) => row) {
  for (const [row, { height, custom }] of expected.rowHeights) {
    if (!custom) continue;
    const got = actual.rowHeights.get(rowMap(row));
    if (!got || Math.abs(got.height - height) > 0.5) out.push(`${actual.name}: row ${row} height ${got?.height} ≠ ${height}`);
  }
}

/** A unit sheet: every row, cell, merge and height must match. */
function compareUnitSheet(actual: ReadSheet, expected: ReadSheet, out: string[]) {
  comparePage(actual, expected, out);
  if (JSON.stringify([...actual.merges].sort()) !== JSON.stringify([...expected.merges].sort())) out.push(`${actual.name}: merges ${actual.merges} ≠ ${expected.merges}`);
  compareHeights(actual, expected, out);
  for (const [ref, cell] of expected.cells) if (interesting(cell)) compareCell(`${actual.name}!${ref}`, actual.cells.get(ref), cell, out);
  for (const [ref, cell] of actual.cells) if (cell.value !== null && !expected.cells.get(ref)) out.push(`${actual.name}!${ref}: unexpected value ${JSON.stringify(cell.value)}`);
}

function compareSummary(actual: ReadSheet, expected: ReadSheet, out: string[]) {
  const at = actual.name;
  comparePage(actual, expected, out);
  const rowOf = (sheet: ReadSheet, text: string) => { for (let row = 1; row < 200; row++) if (sheet.cells.get(`A${row}`)?.value === text) return row; return -1; };
  const nameRows = (sheet: ReadSheet) => { const map = new Map<string, number>(); for (let row = 5; ; row++) { const name = sheet.cells.get(`A${row}`)?.value; if (typeof name !== "string" || name === "ALL UNITS") return map.set("ALL UNITS", row); map.set(name, row); } };
  const actualRows = nameRows(actual);
  const expectedRows = nameRows(expected);
  if (JSON.stringify([...actualRows.keys()].sort()) !== JSON.stringify([...expectedRows.keys()].sort())) { out.push(`${at}: units ${[...actualRows.keys()]} ≠ ${[...expectedRows.keys()]}`); return; }
  // Rows 1–4 and each unit row (matched by name), then the total row.
  for (const [ref, cell] of expected.cells) {
    const match = /^([A-F])(\d+)$/.exec(ref)!;
    const row = Number(match[2]);
    if (row <= 4) { if (interesting(cell)) compareCell(`${at}!${ref}`, actual.cells.get(ref), cell, out); continue; }
    const name = [...expectedRows].find(([, value]) => value === row)?.[0];
    if (name !== undefined && interesting(cell)) compareCell(`${at}!${name}.${match[1]}`, actual.cells.get(`${match[1]}${actualRows.get(name)}`), cell, out);
  }
  const links = (sheet: ReadSheet, rows: Map<string, number>) => [...rows.keys()].filter((name) => name !== "ALL UNITS").map((name) => `${name}:${sheet.hyperlinks.get(`A${rows.get(name)}`)}`).sort();
  if (JSON.stringify(links(actual, actualRows)) !== JSON.stringify(links(expected, expectedRows))) out.push(`${at}: hyperlinks ${links(actual, actualRows)} ≠ ${links(expected, expectedRows)}`);
  // The mock's notes: a "Notes" row, an extra "MOCK DATA" line the real file leaves out, then the lines.
  const notesRow = rowOf(expected, "Notes");
  if (rowOf(actual, "Notes") !== notesRow) out.push(`${at}: Notes row ${rowOf(actual, "Notes")} ≠ ${notesRow}`);
  compareCell(`${at}!Notes`, actual.cells.get(`A${notesRow}`), expected.cells.get(`A${notesRow}`)!, out);
  const lines: number[] = [];
  for (let row = notesRow + 1; typeof expected.cells.get(`A${row}`)?.value === "string"; row++) lines.push(row);
  const hasMockLine = String(expected.cells.get(`A${lines[0]}`)?.value).startsWith("MOCK DATA");
  const noteRows = hasMockLine ? lines.slice(1) : lines;
  noteRows.forEach((row, index) => {
    const target = notesRow + 1 + index;
    const sample = String(expected.cells.get(`A${row}`)?.value).includes("sample");
    compareCell(`${at}!note${index + 1}`, actual.cells.get(`A${target}`), expected.cells.get(`A${row}`)!, out, sample);
    if (!actual.merges.includes(`A${target}:F${target}`)) out.push(`${at}: note ${index + 1} is not merged A:F`);
    const wanted = expected.rowHeights.get(row);
    const got = actual.rowHeights.get(target);
    if (wanted && (!got || Math.abs(got.height - wanted.height) > 0.5)) out.push(`${at}: note ${index + 1} height ${got?.height} ≠ ${wanted.height}`);
  });
  const lastNote = notesRow + noteRows.length;
  if (actual.cells.get(`A${lastNote + 1}`)?.value) out.push(`${at}: extra note line`);
}

const daily = (units: MockData["monthly"]["units"]) => new Map<string, UnitDailyData>(units.map((unit) => [unit.name, { remittances: unit.remittances, expensesByDate: new Map(Object.entries(unit.expensesByDate)) }]));
const yearly = (units: MockData["yearly"]["units"]) => new Map<string, UnitYearData>(units.map((unit) => [unit.name, { months: unit.months, expenseCentavos: unit.expenseCentavos }]));

async function generate(kind: ReportKind, only: string | null) {
  const section = mockData[kind];
  const all = sortUnits(section.units.map((unit) => ({ id: unit.name, name: unit.name })));
  const units = only ? all.filter((unit) => unit.name === only) : all;
  const key = kind === "weekly" ? section.period : section.period;
  const sheets = buildReportSheets({
    kind, key, units, withSummary: only === null,
    ...(kind === "yearly" ? { yearly: yearly(mockData.yearly.units) } : { daily: daily((section as MockData["monthly"]).units) }),
  });
  return readWorkbook(await workbookBytes(sheets));
}

const files: Record<ReportKind, { all: string; one: string }> = {
  monthly: { all: "rolnet-monthly-2026-10-all-units-MOCK.xlsx", one: "rolnet-monthly-2026-10-DHDMM1-MOCK.xlsx" },
  weekly: { all: "rolnet-weekly-2026-10-26-all-units-MOCK.xlsx", one: "rolnet-weekly-2026-10-26-DHDMM1-MOCK.xlsx" },
  yearly: { all: "rolnet-yearly-2026-all-units-MOCK.xlsx", one: "rolnet-yearly-2026-DHDMM1-MOCK.xlsx" },
};

describe.each(["monthly", "weekly", "yearly"] as ReportKind[])("%s report against the client's mocks (feature 014)", (kind) => {
  it("All units workbook equals the mock: summary first, then every unit sheet", async () => {
    const actual = await generate(kind, null);
    const expected = readMock(files[kind].all);
    const out: string[] = [];
    if (actual.sheets[0].name !== "All units") out.push("first sheet is not All units");
    if ([...actual.sheets.slice(1).map((sheet) => sheet.name)].join() !== ["DHDMM1", "DHDMM2", "DKQLM3", "DNPTV4", "DRECB2"].join()) out.push(`tab order ${actual.sheets.map((sheet) => sheet.name)}`);
    compareSummary(actual.sheets[0], expected.sheets[0], out);
    for (const sheet of expected.sheets.slice(1)) {
      const match = actual.sheets.find((item) => item.name === sheet.name);
      if (!match) { out.push(`missing sheet ${sheet.name}`); continue; }
      compareUnitSheet(match, sheet, out);
    }
    expect(out).toEqual([]);
  });

  it("Single unit workbook equals the mock: that unit's sheet only", async () => {
    const actual = await generate(kind, "DHDMM1");
    const expected = readMock(files[kind].one);
    const out: string[] = [];
    if (actual.sheets.length !== 1) out.push(`${actual.sheets.length} sheets`);
    compareUnitSheet(actual.sheets[0], expected.sheets[0], out);
    expect(out).toEqual([]);
  });

  it("Single unit sheet is identical to the same unit's sheet in the All units workbook", async () => {
    const all = await generate(kind, null);
    const one = await generate(kind, "DHDMM1");
    const unit = all.sheets.find((sheet) => sheet.name === "DHDMM1")!;
    expect([...one.sheets[0].cells].map(([ref, cell]) => [ref, cell.value, cell.formula])).toEqual([...unit.cells].map(([ref, cell]) => [ref, cell.value, cell.formula]));
  });
});

describe("the mock comparison itself", () => {
  it("reports a changed value, style, formula, tab colour and row height", async () => {
    const actual = await generate("monthly", "DHDMM1");
    const expected = readMock(files.monthly.one);
    const sheet = actual.sheets[0];
    sheet.cells.get("C9")!.value = 1;
    sheet.cells.get("D5")!.formula = "C5+E5";
    sheet.cells.get("A9")!.style = { ...sheet.cells.get("A9")!.style, fill: "FFFFFF" };
    sheet.tabColor = "000000";
    sheet.rowHeights.set(5, { height: 20, custom: true });
    const out: string[] = [];
    compareUnitSheet(sheet, expected.sheets[0], out);
    expect(out.length).toBeGreaterThanOrEqual(5);
    expect(out.some((line) => line.includes("C9: value"))).toBe(true);
    expect(out.some((line) => line.includes("D5: formula"))).toBe(true);
    expect(out.some((line) => line.includes("A9: fill"))).toBe(true);
  });

  it("covers every written cell of the mocks", () => {
    const expected = readMock(files.monthly.all);
    const compared = expected.sheets.slice(1).reduce((sum, sheet) => sum + [...sheet.cells.values()].filter(interesting).length, 0);
    expect(compared).toBeGreaterThan(1000);
  });
});
