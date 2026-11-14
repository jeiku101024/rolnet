import { describe, expect, it } from "vitest";
import { distributionTotals, sortDistributionRows } from "@/lib/sinking-fund/aggregate";
import { buildDistributionSheet, buildDistributionWorkbook, distributionFileName } from "@/lib/sinking-fund/distribution-workbook";
import type { SfDistribution, SfDistributionDetail, SfDistributionRow } from "@/lib/sinking-fund/types";
import { sheetXml, StyleRegistry } from "@/lib/reports/xlsx";

const distribution = (over: Partial<SfDistribution> = {}): SfDistribution => ({
  id: "d1", dist_date: "2026-12-31", year: 2026, available_before_centavos: 30000, per_participant_centavos: null, participant_count: 4, share_count: 3,
  total_distributed_centavos: 30000, remainder_centavos: 0, notes: null, voided_at: null, void_reason: null, updated_at: "2026-12-31T00:00:00Z", ...over,
});
const person = (name: string, ended: number | null, share: number): SfDistributionRow => ({
  participant_id: name, participant_name: name, savings_before_centavos: ended === null ? null : ended - share, share_centavos: share, ended_total_centavos: ended,
});
const detail = (rows: SfDistributionRow[], over: Partial<SfDistribution> = {}): SfDistributionDetail => {
  const sorted = sortDistributionRows(rows);
  return { distribution: distribution(over), rows: sorted, totals: distributionTotals(sorted) };
};

describe("sorting and totals", () => {
  it("sorts highest ended total first, ties by name, and rows without an ended total last", () => {
    const rows = sortDistributionRows([person("Cy", 100, 0), person("Ana", 100, 0), person("Zed", 900, 5), person("Old", null, 7), person("Bo", 0, 0)]);
    expect(rows.map((row) => row.participant_name)).toEqual(["Zed", "Ana", "Cy", "Bo", "Old"]);
  });

  it("adds the ended totals and shares, and has no ended total when one is not recorded", () => {
    expect(distributionTotals([person("A", 100, 10), person("B", 200, 20)])).toEqual({ ended_total_centavos: 300, share_centavos: 30 });
    expect(distributionTotals([person("A", 100, 10), person("Old", null, 20)])).toEqual({ ended_total_centavos: null, share_centavos: 30 });
    expect(distributionTotals([])).toEqual({ ended_total_centavos: null, share_centavos: 0 });
  });
});

describe("distribution sheet", () => {
  const sheet = buildDistributionSheet(detail([person("P1", 105000, 5000), person("P3", 315000, 15000), person("P2", 210000, 10000), person("P4", 0, 0)]));
  const cell = (row: number, column: number) => sheet.rows[row - 1].cells[column];

  it("has the header block, the table sorted highest first, and a totals row", () => {
    expect(cell(1, 0)?.v).toBe("Sinking fund distribution 2026");
    expect(cell(3, 0)?.v).toBe("Sinking fund total for the year");
    expect(cell(3, 3)?.v).toBe(6300);
    expect([5, 6, 7, 8].map((row) => cell(row, 1)?.v)).toEqual(["P3", "P2", "P1", "P4"]);
    expect([5, 6, 7, 8].map((row) => cell(row, 0)?.v)).toEqual([1, 2, 3, 4]);
    expect(cell(5, 2)?.v).toBe(3150);
    expect(cell(5, 3)?.v).toBe(150);
    expect(cell(9, 0)?.v).toBe("Total");
    expect(cell(9, 2)).toMatchObject({ v: 6300, f: "SUM(C5:C8)" });
    expect(cell(9, 3)).toMatchObject({ v: 300, f: "SUM(D5:D8)" });
  });

  it("marks a voided distribution and shows notes", () => {
    const voided = buildDistributionSheet(detail([person("A", 100, 10)], { voided_at: "2027-01-02T00:00:00Z", notes: "Year-end 2026" }));
    expect(voided.rows[0].cells[0]?.v).toBe("Sinking fund distribution 2026 (VOIDED)");
    expect(voided.rows.at(-1)?.cells[0]?.v).toBe("Notes: Year-end 2026");
  });

  it("shows Not recorded when the ended totals were not saved (older distributions)", () => {
    const legacy = buildDistributionSheet(detail([person("Old", null, 2000)], { per_participant_centavos: 2000 }));
    expect(legacy.rows[2].cells[3]?.v).toBe("Not recorded");
    expect(legacy.rows[4].cells[2]?.v).toBe("Not recorded");
    expect(legacy.rows[5].cells[2]?.v).toBe("Not recorded");
  });

  it("prints on one A4 page with narrow margins", () => {
    const xml = sheetXml(sheet, new StyleRegistry());
    expect(xml).toContain('paperSize="9"');
    expect(xml).toContain('orientation="portrait"');
    expect(xml).toContain('fitToWidth="1"');
    expect(xml).toContain('fitToHeight="1"');
    expect(xml).toContain('<pageSetUpPr fitToPage="1"/>');
    expect(xml).toContain('left="0.25" right="0.25" top="0.75" bottom="0.75"');
  });

  it("keeps a 50-participant table on the same one-page setup", () => {
    const rows = Array.from({ length: 50 }, (_, index) => person(`Participant ${String(index + 1).padStart(2, "0")}`, 100000 - index * 100, 500));
    const big = buildDistributionSheet(detail(rows, { participant_count: 50, share_count: 50, total_distributed_centavos: 25000 }));
    expect(big.rows).toHaveLength(4 + 50 + 1);
    const xml = sheetXml(big, new StyleRegistry());
    expect(xml).toContain('fitToWidth="1" fitToHeight="1"');
    expect(xml).toContain('<dimension ref="A1:D55"/>');
  });
});

describe("workbook file", () => {
  it("builds a zip with the distribution sheet and a name from the year and date", async () => {
    const bytes = await buildDistributionWorkbook(detail([person("A", 100, 10)]));
    expect(bytes.length).toBeGreaterThan(200);
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // "PK"
    expect(distributionFileName({ year: 2026, dist_date: "2026-12-31" })).toBe("rolnet-sinking-fund-2026-2026-12-31.xlsx");
  });
});
