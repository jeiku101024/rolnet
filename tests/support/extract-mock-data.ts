// Feature 014 (research R14): rebuilds tests/fixtures/reports/mock-data.json from the client's mock workbooks, so
// the fixture can be reviewed and regenerated instead of trusted. The mock-comparison tests feed this data to
// the generator and compare the result with the mocks. Run through tests/unit/report-mock-data.test.ts:
//   UPDATE_MOCK_DATA=1 corepack pnpm exec vitest run tests/unit/report-mock-data.test.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readWorkbook, type ReadSheet } from "./xlsx-read";

export interface MockRemittance { date: string; driverName: string; rentalCentavos: number; allowanceCentavos: number }
export interface MockDailyUnit { name: string; remittances: MockRemittance[]; expensesByDate: Record<string, number> }
export interface MockYearlyUnit { name: string; months: { rentalCentavos: number; allowanceCentavos: number }[]; expenseCentavos: number }
export interface MockData {
  monthly: { period: string; units: MockDailyUnit[] };
  weekly: { period: string; units: MockDailyUnit[] };
  yearly: { period: string; units: MockYearlyUnit[] };
}

/** Vitest runs from the repository root. */
export const fixtureDir = `${join(process.cwd(), "tests", "fixtures", "reports")}/`;

const centavos = (value: unknown) => (typeof value === "number" ? Math.round(value * 100) : 0);

function isoDate(serial: number) {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
}

function readDaily(sheet: ReadSheet): MockDailyUnit {
  const unit: MockDailyUnit = { name: sheet.name, remittances: [], expensesByDate: {} };
  let blockStart: string | null = null;
  for (let row = 5; ; row++) {
    const a = sheet.cells.get(`A${row}`)?.value;
    if (typeof a === "number") {
      const date = isoDate(a);
      blockStart ??= date;
      const rental = sheet.cells.get(`C${row}`)?.value;
      if (typeof rental === "number") {
        unit.remittances.push({ date, driverName: String(sheet.cells.get(`B${row}`)?.value ?? ""), rentalCentavos: centavos(rental), allowanceCentavos: centavos(sheet.cells.get(`E${row}`)?.value) });
      }
    } else if (typeof a === "string" && /^Week\b.*Subtotal/.test(a)) {
      const expenses = centavos(sheet.cells.get(`C${row + 1}`)?.value);
      // The mocks give one expenses figure per block; it goes on the block's first day.
      if (expenses && blockStart) unit.expensesByDate[blockStart] = expenses;
      blockStart = null;
    } else if (a === "GRAND TOTAL" || a === undefined) {
      return unit;
    }
  }
}

function readYearly(sheet: ReadSheet): MockYearlyUnit {
  return {
    name: sheet.name,
    months: Array.from({ length: 12 }, (_, index) => ({
      rentalCentavos: centavos(sheet.cells.get(`B${5 + index}`)?.value),
      allowanceCentavos: centavos(sheet.cells.get(`D${5 + index}`)?.value),
    })),
    expenseCentavos: centavos(sheet.cells.get("B18")?.value),
  };
}

const unitSheets = (file: string) => readWorkbook(new Uint8Array(readFileSync(`${fixtureDir}${file}`))).sheets.slice(1);

export function extractMockData(): MockData {
  return {
    monthly: { period: "2026-10", units: unitSheets("rolnet-monthly-2026-10-all-units-MOCK.xlsx").map(readDaily) },
    weekly: { period: "2026-10-26", units: unitSheets("rolnet-weekly-2026-10-26-all-units-MOCK.xlsx").map(readDaily) },
    yearly: { period: "2026", units: unitSheets("rolnet-yearly-2026-all-units-MOCK.xlsx").map(readYearly) },
  };
}
