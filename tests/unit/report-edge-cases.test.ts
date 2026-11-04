import { describe, expect, it } from "vitest";
import { buildReportSheets } from "@/lib/reports/build-report";
import { monthlyUnitSheet } from "@/lib/reports/report-layout";
import { workbookBytes } from "@/lib/reports/xlsx";
import { readWorkbook } from "@/tests/support/xlsx-read";

// Feature 014 (spec edge cases, FR-012, FR-013, FR-101): odd unit names must never break a formula, a link or
// the file.

const names = ["All units", "A".repeat(45), `${"B".repeat(31)} one`, `${"B".repeat(31)} two`, "Mang Ben's", "'quoted'", "R&D <1>", "a:b/c?d*e[f]g", "rolnet-10", "rolnet-2"];
const units = names.map((name, index) => ({ id: `u${index}`, name }));

describe("odd unit names", () => {
  it("keep every summary formula and link pointed at a sheet that exists", async () => {
    const workbook = readWorkbook(await workbookBytes(buildReportSheets({ kind: "monthly", key: "2026-10", units, withSummary: true })));
    const sheetNames = workbook.sheets.map((sheet) => sheet.name);
    expect(sheetNames[0]).toBe("All units");
    expect(new Set(sheetNames.map((name) => name.toLowerCase())).size).toBe(sheetNames.length);
    expect(sheetNames.every((name) => name.length <= 31 && !/[:\\/?*[\]]/.test(name) && !/^'|'$/.test(name))).toBe(true);
    expect(sheetNames).toContain("All units (unit)");
    const summary = workbook.sheets[0];
    for (const [ref, cell] of summary.cells) {
      if (!cell.formula || !/^[B-F]\d+$/.test(ref) || cell.formula.startsWith("SUM(")) continue;
      const target = /^'((?:[^']|'')+)'!/.exec(cell.formula)?.[1].replace(/''/g, "'");
      expect(sheetNames, `${ref} ${cell.formula}`).toContain(target);
    }
    for (const [ref, location] of summary.hyperlinks) {
      const target = /^'((?:[^']|'')+)'!A1$/.exec(location)?.[1].replace(/''/g, "'");
      expect(sheetNames, `${ref} ${location}`).toContain(target);
    }
    expect(summary.hyperlinks.size).toBe(names.length);
  });

  it("keep the print titles on the right sheets", async () => {
    const workbook = readWorkbook(await workbookBytes(buildReportSheets({ kind: "weekly", key: "2026-10-26", units, withSummary: true })));
    expect(workbook.sheets[0].printTitles).toBeNull();
    for (const sheet of workbook.sheets.slice(1)) expect(sheet.printTitles).toBe(`'${sheet.name.replace(/'/g, "''")}'!$1:$4`);
  });

  it("write the unit's real name in the second line, not the cleaned sheet name", () => {
    const { sheet } = monthlyUnitSheet("a-b-c-d-e-f-g", "a:b/c?d*e[f]g", { remittances: [], expensesByDate: new Map() }, "2026-10");
    expect(sheet.rows[1].cells[0]?.v).toBe("Unit a:b/c?d*e[f]g  ·  Monthly report");
  });
});

describe("a year, a month and a week that have no records", () => {
  it("still produce every sheet with zero totals", async () => {
    for (const [kind, key] of [["monthly", "2026-10"], ["weekly", "2026-10-26"], ["yearly", "2026"]] as const) {
      const workbook = readWorkbook(await workbookBytes(buildReportSheets({ kind, key, units: units.slice(0, 3), withSummary: true })));
      expect(workbook.sheets).toHaveLength(4);
      const total = [...workbook.sheets[0].cells].find(([, cell]) => cell.value === "ALL UNITS");
      expect(total).toBeDefined();
      expect(workbook.sheets[0].cells.get(`B${Number(total![0].slice(1))}`)?.value).toBe(0);
    }
  });
});
