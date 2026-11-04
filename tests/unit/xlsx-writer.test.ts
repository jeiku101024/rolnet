import { inflateRawSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { columnName, escapeXml, sheetRef, workbookBytes, type SheetModel } from "@/lib/reports/xlsx";
import { buildZip, crc32, zipEntry } from "@/lib/reports/zip";
import { readWorkbook, unzip } from "@/tests/support/xlsx-read";

const unit = (name: string, tabColor = "2F5496"): SheetModel => ({
  name,
  tabColor,
  columns: [36, 24, 17],
  merges: ["A1:C1", "A2:C2"],
  hyperlinks: [],
  printTitles: true,
  rows: [
    { h: 30, cells: [{ v: `Tom & "Jerry" <x> ${name}`, s: "title" }, { v: null, s: "title" }, { v: null, s: "title" }] },
    { h: 20, cells: [{ v: "Unit  ·  Monthly report", s: "subtitle" }, { v: null, s: "subtitle" }, { v: null, s: "subtitle" }] },
    { h: 10, cells: [] },
    { h: 20, cells: [{ v: "Date", s: "headFirst" }, { v: "Driver", s: "headText" }, { v: "Rental", s: "headAmount" }] },
    { h: 13, cells: [{ v: 46296, s: "date" }, { v: "Juan", s: "text" }, { v: 180, s: "amount" }] },
    { h: 13, cells: [{ v: "Week 1 Subtotal  ·  Oct 1–4", s: "subLabel" }, { v: null, s: "subAmount" }, { v: 180, f: "SUM(C5:C5)", s: "subAmount" }] },
  ],
});

describe("zip (feature 014, research R2)", () => {
  it("round-trips deflated parts with the right CRC and sizes", async () => {
    const text = "Rental ".repeat(2000);
    const entry = await zipEntry("xl/a.xml", text);
    expect(entry.method).toBe(8);
    expect(entry.data.length).toBeLessThan(text.length / 10);
    expect(entry.crc).toBe(crc32(new TextEncoder().encode(text)));
    expect(new TextDecoder().decode(inflateRawSync(entry.data))).toBe(text);
    const parts = unzip(buildZip([entry]));
    expect(new TextDecoder().decode(parts.get("xl/a.xml")!)).toBe(text);
  });

  it("stores parts when CompressionStream is not available", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    try {
      const entry = await zipEntry("xl/a.xml", "<x/>");
      expect(entry.method).toBe(0);
      expect(entry.crc).toBe(crc32(new TextEncoder().encode("<x/>")));
      expect(new TextDecoder().decode(unzip(buildZip([entry])).get("xl/a.xml")!)).toBe("<x/>");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("xlsx writer (feature 014, research R1, R3, R11)", () => {
  it("writes every part and two sheets that the reader can open", async () => {
    const bytes = await workbookBytes([unit("All units", "1F3864"), unit("rolnet-1")]);
    const workbook = readWorkbook(bytes);
    expect(workbook.partNames).toEqual(expect.arrayContaining([
      "[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml", "docProps/app.xml", "docProps/core.xml",
    ]));
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(["All units", "rolnet-1"]);
    expect(workbook.sheets.map((sheet) => sheet.tabColor)).toEqual(["1F3864", "2F5496"]);
    expect(workbook.calcFullOnLoad).toBe(true);
  });

  it("applies fonts, fills, borders, number formats and alignment", async () => {
    const sheet = readWorkbook(await workbookBytes([unit("rolnet-1")])).sheets[0];
    const title = sheet.cells.get("A1")!;
    expect(title.value).toBe('Tom & "Jerry" <x> rolnet-1');
    expect(title.style).toMatchObject({ fontName: "Arial", size: 16, bold: true, color: "FFFFFF", fill: "1F3864", horizontal: "left", vertical: "center", indent: 1 });
    expect(sheet.cells.get("A2")!.style).toMatchObject({ size: 11, bold: true, color: "1F3864", fill: "D9E2F3" });
    expect(sheet.cells.get("C4")!.style).toMatchObject({ size: 10, bold: true, fill: "2F5496", horizontal: "right" });
    expect(sheet.cells.get("A5")!.style).toMatchObject({ bottom: "thin:BFBFBF", numFmt: "ddd, mmm d", indent: 1 });
    expect(sheet.cells.get("C5")!.style).toMatchObject({ numFmt: '#,##0;[Red]-#,##0;-', horizontal: "right" });
    expect(sheet.cells.get("A6")!.style).toMatchObject({ bold: true, fill: "D9E2F3", indent: 1 });
  });

  it("writes formulas with their cached values", async () => {
    const cell = readWorkbook(await workbookBytes([unit("rolnet-1")])).sheets[0].cells.get("C6")!;
    expect(cell.formula).toBe("SUM(C5:C5)");
    expect(cell.value).toBe(180);
  });

  it("sets merges, widths, heights, the frozen pane and print setup", async () => {
    const sheet = readWorkbook(await workbookBytes([unit("rolnet-1")])).sheets[0];
    expect(sheet.merges).toEqual(["A1:C1", "A2:C2"]);
    expect([...sheet.widths]).toEqual([[1, 36], [2, 24], [3, 17]]);
    expect(sheet.rowHeights.get(1)).toEqual({ height: 30, custom: true });
    expect(sheet.rowHeights.get(5)).toEqual({ height: 13, custom: true });
    expect(sheet.freeze).toEqual({ topLeftCell: "A5", xSplit: 0, ySplit: 4 });
    expect(sheet.margins).toEqual({ left: "0.25", right: "0.25", top: "0.75", bottom: "0.75", header: "0.3", footer: "0.3" });
    expect(sheet.pageSetup).toMatchObject({ paperSize: "9", orientation: "portrait", fitToWidth: "1", fitToHeight: "1" });
    expect(sheet.printOptions).toMatchObject({ horizontalCentered: "1" });
    expect(sheet.fitToPage).toBe(true);
    expect(sheet.printTitles).toBe("'rolnet-1'!$1:$4");
  });

  it("writes internal hyperlinks that quote the sheet name", async () => {
    const summary: SheetModel = { ...unit("All units", "1F3864"), printTitles: false, hyperlinks: [{ ref: "A5", sheet: "Mang Ben's" }] };
    const sheet = readWorkbook(await workbookBytes([summary])).sheets[0];
    expect(sheet.hyperlinks.get("A5")).toBe("'Mang Ben''s'!A1");
    expect(sheet.printTitles).toBeNull();
  });

  it("puts worksheet children in schema order and escapes names", async () => {
    const bytes = await workbookBytes([{ ...unit("R&D <1>"), hyperlinks: [{ ref: "A5", sheet: "R&D <1>" }] }]);
    const xml = new TextDecoder().decode(unzip(bytes).get("xl/worksheets/sheet1.xml")!);
    const order = ["<sheetPr", "<dimension", "<sheetViews", "<sheetFormatPr", "<cols", "<sheetData", "<mergeCells", "<hyperlinks", "<printOptions", "<pageMargins", "<pageSetup"];
    const positions = order.map((tag) => xml.indexOf(tag));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(readWorkbook(bytes).sheets[0].name).toBe("R&D <1>");
  });

  it("writes well-formed XML in every part, so Excel has nothing to repair", async () => {
    const bytes = await workbookBytes([unit("All units", "1F3864"), { ...unit("Mang Ben's"), hyperlinks: [{ ref: "A5", sheet: "R&D <1>" }] }]);
    const parts = unzip(bytes);
    expect(parts.size).toBeGreaterThanOrEqual(9);
    for (const [name, data] of parts) {
      const xml = new DOMParser().parseFromString(new TextDecoder().decode(data), "application/xml");
      expect(xml.getElementsByTagName("parsererror"), name).toHaveLength(0);
    }
  });

  it("serialises sheets one at a time from an async source", async () => {
    async function* sheets() { yield unit("a"); yield unit("b"); yield unit("c"); }
    expect(readWorkbook(await workbookBytes(sheets())).sheets.map((sheet) => sheet.name)).toEqual(["a", "b", "c"]);
  });

  it("names columns, quotes sheet names and escapes XML", () => {
    expect([0, 1, 25, 26, 27].map(columnName)).toEqual(["A", "B", "Z", "AA", "AB"]);
    expect(sheetRef("Mang Ben's")).toBe("'Mang Ben''s'");
    expect(escapeXml(`a&b<c>"d"'e'`)).toBe("a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;");
  });
});
