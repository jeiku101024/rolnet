import { describe, expect, it } from "vitest";
import { columnName, crc32, fitColumns, safeSheetName, styleIndex, workbookBytes, type Sheet } from "@/lib/reports/xlsx";
import { readStoredZip, zipText } from "@/tests/support/stored-zip";

const sheet: Sheet = {
  name: "Monthly - R&D <1>",
  columns: [7, 16, 18],
  rows: [
    [{ value: "Week", style: "header" }, { value: "Day", style: "header" }, { value: "Rental", style: "header" }],
    [{ value: 1, style: "body" }, { value: "Tom & \"Jerry\" <x>", style: "body" }, { value: 180, style: "body", format: "whole" }],
    [{ value: null, style: "subtotal" }, { value: "Week 1 Subtotal", style: "subtotal" }, { value: 180, formula: "SUM(C2:C2)", style: "subtotal", format: "whole" }],
  ],
};

describe("xlsx writer (feature 009, research R4 and R5)", () => {
  const bytes = workbookBytes(sheet);
  const entries = readStoredZip(bytes);

  it("writes a valid stored zip with every workbook part", () => {
    for (const entry of entries) expect(crc32(entry.data)).toBe(entry.crc);
    expect(entries.map((entry) => entry.name)).toEqual(expect.arrayContaining([
      "[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "docProps/app.xml", "docProps/core.xml",
    ]));
    expect(zipText(bytes, "xl/workbook.xml")).toContain('fullCalcOnLoad="1"');
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("freezes the header row, sets column widths and escapes text", () => {
    const xml = zipText(bytes, "xl/worksheets/sheet1.xml");
    expect(xml).toMatch(/<pane ySplit="1" topLeftCell="A2"[^>]*state="frozen"\/>/);
    expect(xml).toContain('<col min="2" max="2" width="16" customWidth="1"/>');
    expect(xml).toContain("Tom &amp; &quot;Jerry&quot; &lt;x&gt;");
    expect(xml).toContain('t="inlineStr"');
    expect(xml).toContain("<f>SUM(C2:C2)</f><v>180</v>");
    expect(xml).toContain(`<c r="A3" s="${styleIndex("subtotal")}"/>`);
    expect(zipText(bytes, "xl/workbook.xml")).toContain('name="Monthly - R&amp;D &lt;1&gt;"');
  });

  it("defines the template's fills, fonts, borders and number formats", () => {
    const xml = zipText(bytes, "xl/styles.xml");
    for (const rgb of ["FF1F3864", "FFD9E1F2", "FFFFFFFF", "FF00B050"]) expect(xml).toContain(rgb);
    expect(xml).toContain('style="thick"');
    expect(xml).toContain('formatCode="#,##0;[Red]-#,##0"');
    expect(xml).toContain('formatCode="#,##0.00;[Red]-#,##0.00"');
    expect(xml).toContain('formatCode="#,##0;[Red]-#,##0;&quot;-&quot;"');
    const xfCount = Number(/<cellXfs count="(\d+)"/.exec(xml)?.[1]);
    expect(styleIndex("grandItalic", "yearDecimal")).toBe(xfCount - 1);
  });

  it("names columns, cleans sheet names and sizes columns to fit", () => {
    expect([0, 25, 26, 27].map(columnName)).toEqual(["A", "Z", "AA", "AB"]);
    expect(safeSheetName("Yearly - Unit [A]/B:C*D?E\\F with a very long name")).toBe("Yearly - Unit ABCDEF with a ver");
    expect(safeSheetName("Yearly - Unit [A]/B:C*D?E\\F with a very long name").length).toBeLessThanOrEqual(31);
    expect(fitColumns([[{ value: "Week 1 Subtotal", style: "subtotal" }, { value: 123456.5, style: "body", format: "decimal" }]], [7, 8])).toEqual([17, 12]);
  });
});
