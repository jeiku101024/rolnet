import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UnitDailyData, UnitYearData } from "@/lib/reports/report-layout";
import { buildPayloadWorkbook, toPayload } from "@/lib/reports/report-payload";

// Feature 019 (FR-015, SC-002): the remittance workbooks must stay byte-identical when the shared writer gains new
// options. tests/fixtures/report-golden.json holds the SHA-256 of each file, recorded from the code before feature
// 019 touched the writer. Refreshed once for feature 020 (Notes column and Deposit from payments; file names unchanged). Never regenerate it otherwise; set GOLDEN_RECORD=1 only when the fixture does not exist.

const fixturePath = "tests/fixtures/report-golden.json";
const units = [{ id: "a", name: "ROLNET-1" }, { id: "b", name: "ROLNET-2" }, { id: "c", name: "ROLNET-10" }];
const daily = new Map<string, UnitDailyData>([
  ["a", { remittances: [{ date: "2026-10-26", rentalCentavos: 18000, allowanceCentavos: 4000, depositCentavos: 14000, latePayments: [], driverName: "Juan Dela Cruz" }, { date: "2026-10-28", rentalCentavos: 30000, allowanceCentavos: 4000, depositCentavos: 26000, latePayments: [], driverName: "Pedro Santos" }, { date: "2026-10-29", rentalCentavos: 0, allowanceCentavos: 0, depositCentavos: 0, latePayments: [], driverName: "Ana Reyes" }], expensesByDate: new Map([["2026-10-30", 12000], ["2026-10-27", 5050]]) }],
  ["c", { remittances: [{ date: "2026-10-31", rentalCentavos: 18000, allowanceCentavos: 4000, depositCentavos: 14000, latePayments: [], driverName: "Luis" }], expensesByDate: new Map() }],
]);
const yearly = new Map<string, UnitYearData>([
  ["b", { months: Array.from({ length: 12 }, (_, index) => ({ rentalCentavos: index * 18000, allowanceCentavos: index * 4000, depositCentavos: index * 14000 })), expenseCentavos: 25000 }],
  ["a", { months: Array.from({ length: 12 }, (_, index) => ({ rentalCentavos: (index % 3) * 9000, allowanceCentavos: 0, depositCentavos: (index % 3) * 9000 })), expenseCentavos: 0 }],
]);

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function build() {
  const out: Record<string, { fileName: string; sha256: string }> = {};
  const cases = {
    weekly: toPayload({ kind: "weekly", key: "2026-10-26", scope: "all", units, daily }),
    monthly: toPayload({ kind: "monthly", key: "2026-10", scope: "all", units, daily }),
    monthlySingleUnit: toPayload({ kind: "monthly", key: "2026-10", scope: "unit", units: [units[0]], daily }),
    yearly: toPayload({ kind: "yearly", key: "2026", scope: "all", units, yearly }),
  };
  for (const [name, payload] of Object.entries(cases)) out[name] = { fileName: payload.fileName, sha256: sha(await buildPayloadWorkbook(payload)) };
  return out;
}

describe("remittance workbooks are unchanged (feature 019)", () => {
  it("matches the recorded golden hashes", async () => {
    const actual = await build();
    if (process.env.GOLDEN_RECORD === "1" && !existsSync(fixturePath)) writeFileSync(fixturePath, JSON.stringify(actual, null, 2) + "\n");
    expect(actual).toEqual(JSON.parse(readFileSync(fixturePath, "utf8")));
  });
});
