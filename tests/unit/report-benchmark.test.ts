import { describe, expect, it } from "vitest";
import { buildReportSheets } from "@/lib/reports/build-report";
import type { UnitDailyData } from "@/lib/reports/report-layout";
import { workbookBytes } from "@/lib/reports/xlsx";
import { readWorkbook } from "@/tests/support/xlsx-read";

// Feature 014 (research R4): a 100-unit All units monthly workbook, one remittance a day. The workbook is built
// in the browser, because it takes far more than the free Workers plan's 10 ms of CPU. This guards against the
// generator getting much slower on a phone-class device: a generous 5 second wall-time budget, a 5 MB size cap,
// and a console line with the measured numbers (about 250 ms and 257 KB when this was written).

function synthetic(unitCount: number) {
  const units = Array.from({ length: unitCount }, (_, index) => ({ id: `u${index + 1}`, name: `rolnet-${index + 1}` }));
  const daily = new Map<string, UnitDailyData>();
  for (const unit of units) {
    const remittances = Array.from({ length: 31 }, (_, day) => ({ date: `2026-10-${String(day + 1).padStart(2, "0")}`, rentalCentavos: 18000, allowanceCentavos: 4000, driverName: `Driver ${unit.name}` }));
    daily.set(unit.id, { remittances, expensesByDate: new Map([["2026-10-06", 12000]]) });
  }
  return { units, daily };
}

describe("100-unit workbook (feature 014, research R4)", () => {
  it("generates 101 sheets that open and stay small", async () => {
    const { units, daily } = synthetic(100);
    const cpuBefore = process.cpuUsage();
    const started = performance.now();
    const sheets = buildReportSheets({ kind: "monthly", key: "2026-10", units, daily, withSummary: true });
    const built = performance.now();
    const bytes = await workbookBytes(sheets);
    const done = performance.now();
    const cpu = process.cpuUsage(cpuBefore);
    console.info(`100 units: build ${(built - started).toFixed(0)} ms, write+compress ${(done - built).toFixed(0)} ms, total ${(done - started).toFixed(0)} ms, cpu ${((cpu.user + cpu.system) / 1000).toFixed(0)} ms, ${(bytes.length / 1024).toFixed(0)} KB`);
    expect(done - started).toBeLessThan(5000);
    expect(bytes.length).toBeLessThan(5 * 1024 * 1024);
    const workbook = readWorkbook(bytes);
    expect(workbook.sheets).toHaveLength(101);
    expect(workbook.sheets[0].name).toBe("All units");
    expect(workbook.sheets[100].name).toBe("rolnet-100");
    expect(workbook.sheets[10].name).toBe("rolnet-10");
  });
});
