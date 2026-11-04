import { describe, expect, it } from "vitest";
import { buildReportSheets } from "@/lib/reports/build-report";
import type { ReportKind } from "@/lib/reports/periods";
import type { UnitDailyData, UnitYearData } from "@/lib/reports/report-layout";
import { buildPayloadWorkbook, fromPayload, toPayload, type ReportPayload } from "@/lib/reports/report-payload";
import { workbookBytes } from "@/lib/reports/xlsx";
import { readWorkbook } from "@/tests/support/xlsx-read";

// Feature 014 (research R4): the route returns this JSON and the browser builds the workbook from it. The
// workbook built from the JSON must equal the one built straight from the data.

const units = [{ id: "a", name: "rolnet-1" }, { id: "b", name: "rolnet-2" }];
const daily = new Map<string, UnitDailyData>([
  ["a", { remittances: [{ date: "2026-10-26", rentalCentavos: 18000, allowanceCentavos: 4000, driverName: "Juan Dela Cruz" }, { date: "2026-10-28", rentalCentavos: 30000, allowanceCentavos: 4000, driverName: "Pedro Santos" }], expensesByDate: new Map([["2026-10-30", 12000]]) }],
]);
const yearly = new Map<string, UnitYearData>([
  ["b", { months: Array.from({ length: 12 }, (_, index) => ({ rentalCentavos: index * 18000, allowanceCentavos: index * 4000 })), expenseCentavos: 25000 }],
]);

const cells = async (bytes: Uint8Array) => readWorkbook(bytes).sheets.map((sheet) => [sheet.name, [...sheet.cells].map(([ref, cell]) => [ref, cell.value, cell.formula])]);

describe("report payload (contracts/reports-http.md)", () => {
  it("survives JSON and builds the same workbook as the data it came from", async () => {
    for (const kind of ["weekly", "monthly"] as ReportKind[]) {
      const key = kind === "weekly" ? "2026-10-26" : "2026-10";
      const payload = JSON.parse(JSON.stringify(toPayload({ kind, key, scope: "all", units, daily }))) as ReportPayload;
      const direct = await workbookBytes(buildReportSheets({ kind, key, units, daily, withSummary: true }));
      expect(await cells(await buildPayloadWorkbook(payload))).toEqual(await cells(direct));
    }
  });

  it("carries yearly data the same way", async () => {
    const payload = JSON.parse(JSON.stringify(toPayload({ kind: "yearly", key: "2026", scope: "all", units, yearly }))) as ReportPayload;
    const direct = await workbookBytes(buildReportSheets({ kind: "yearly", key: "2026", units, yearly, withSummary: true }));
    expect(await cells(await buildPayloadWorkbook(payload))).toEqual(await cells(direct));
    expect(payload.daily).toBeUndefined();
  });

  it("puts the summary first for all units and leaves it out for a single unit", async () => {
    const all = await buildPayloadWorkbook(toPayload({ kind: "monthly", key: "2026-10", scope: "all", units, daily }));
    expect(readWorkbook(all).sheets.map((sheet) => sheet.name)).toEqual(["All units", "rolnet-1", "rolnet-2"]);
    const one = await buildPayloadWorkbook(toPayload({ kind: "monthly", key: "2026-10", scope: "unit", units: [units[0]], daily }));
    expect(readWorkbook(one).sheets.map((sheet) => sheet.name)).toEqual(["rolnet-1"]);
  });

  it("names the file for each kind and scope", () => {
    expect(toPayload({ kind: "weekly", key: "2026-10-26", scope: "all", units, daily }).fileName).toBe("rolnet-weekly-2026-10-26-all-units.xlsx");
    expect(toPayload({ kind: "monthly", key: "2026-10", scope: "unit", units: [units[0]], daily }).fileName).toBe("rolnet-monthly-2026-10-rolnet-1.xlsx");
    expect(toPayload({ kind: "yearly", key: "2026", scope: "unit", units: [units[1]], yearly }).fileName).toBe("rolnet-yearly-2026-rolnet-2.xlsx");
  });

  it("restores dates, expenses and months when read back", () => {
    const back = fromPayload(JSON.parse(JSON.stringify(toPayload({ kind: "monthly", key: "2026-10", scope: "all", units, daily }))));
    expect(back.daily?.get("a")?.expensesByDate.get("2026-10-30")).toBe(12000);
    expect(back.daily?.get("a")?.remittances).toHaveLength(2);
    expect(back.daily?.get("b")).toBeUndefined();
    expect(back.withSummary).toBe(true);
  });

  it("shows units without data as blank days and zero amounts", async () => {
    const sheets = readWorkbook(await buildPayloadWorkbook(toPayload({ kind: "weekly", key: "2026-10-26", scope: "all", units, daily }))).sheets;
    expect(sheets[2].cells.get("B5")?.value).toBeNull();
    expect(sheets[2].cells.get("C12")?.value).toBe(0);
  });
});
