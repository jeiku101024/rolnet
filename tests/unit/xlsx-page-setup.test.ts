import { describe, expect, it } from "vitest";
import { StyleRegistry, sheetXml, workbookBytes, OVERDUE_FORMAT, type SheetModel } from "@/lib/reports/xlsx";
import { buildDistributionSheet } from "@/lib/sinking-fund/distribution-workbook";
import { readWorkbook } from "@/tests/support/xlsx-read";

// Feature 019: the writer gains optional orientation and page height; the defaults must not change today's files.

const base: SheetModel = { name: "Sheet", tabColor: "1F3864", columns: [10, 10], rows: [{ cells: [{ v: "x", s: "text" }] }], merges: [], hyperlinks: [], printTitles: false };

describe("sheet page setup", () => {
  it("keeps portrait, one page wide and tall, Narrow margins when nothing is set", () => {
    const xml = sheetXml(base, new StyleRegistry());
    expect(xml).toContain('<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>');
    expect(xml).toContain('<pageMargins left="0.25" right="0.25" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>');
  });

  it("serializes an existing distribution sheet with the same page setup as before", () => {
    const detail = { distribution: { id: "d", dist_date: "2026-11-13", available_before_centavos: 0, per_participant_centavos: null, participant_count: 1, share_count: 1, year: 2026, total_distributed_centavos: 100, remainder_centavos: 0, notes: null, voided_at: null, updated_at: "" }, rows: [{ participant_id: "p", participant_name: "Ana", savings_before_centavos: 1000, share_centavos: 100, ended_total_centavos: 1100 }], totals: { ended_total_centavos: 1100, share_centavos: 100 } };
    const xml = sheetXml(buildDistributionSheet(detail), new StyleRegistry());
    expect(xml).toContain('orientation="portrait" fitToWidth="1" fitToHeight="1"');
  });

  it("writes landscape and automatic height when asked", () => {
    const xml = sheetXml({ ...base, orientation: "landscape", fitToHeight: 0 }, new StyleRegistry());
    expect(xml).toContain('orientation="landscape" fitToWidth="1" fitToHeight="0"');
  });

  it("repeats rows 1 to 4 on every page when printTitles is on", async () => {
    const bytes = await workbookBytes([{ ...base, printTitles: true }]);
    const sheet = readWorkbook(bytes).sheets[0];
    expect(sheet.name).toBe("Sheet");
    expect(sheet.printTitles).toBe("'Sheet'!$1:$4");
  });

  it("keeps an overdue amount a number and appends the word Overdue in its format", async () => {
    const bytes = await workbookBytes([{ ...base, rows: [{ cells: [{ v: 1234.5, s: "overdueAmountCents" }] }] }]);
    const sheet = readWorkbook(bytes).sheets[0];
    const cell = sheet.cells.get("A1")!;
    expect(cell.value).toBe(1234.5);
    expect(OVERDUE_FORMAT).toContain('" Overdue"');
    expect(cell.style.numFmt).toContain("Overdue");
    expect(cell.style.bold).toBe(true);
    expect(cell.style.fill).not.toBeNull();
  });
});
