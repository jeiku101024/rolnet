import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractMockData, fixtureDir } from "@/tests/support/extract-mock-data";

const file = `${fixtureDir}mock-data.json`;

describe("mock data fixture (feature 014, research R14)", () => {
  it("matches what the six mock workbooks contain", () => {
    const extracted = extractMockData();
    if (process.env.UPDATE_MOCK_DATA === "1" || !existsSync(file)) writeFileSync(file, `${JSON.stringify(extracted, null, 2)}\n`);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(extracted);
  });

  it("has five units per kind, each with data", () => {
    const data = extractMockData();
    expect(data.monthly.units).toHaveLength(5);
    expect(data.weekly.units).toHaveLength(5);
    expect(data.yearly.units).toHaveLength(5);
    expect(data.monthly.units[0].name).toBe("DHDMM1");
    expect(data.monthly.units[0].remittances.length).toBeGreaterThan(10);
    expect(data.weekly.units[0].remittances.every((row) => row.date >= "2026-10-26" && row.date <= "2026-11-01")).toBe(true);
    expect(data.yearly.units[0].months.some((month) => month.rentalCentavos > 0)).toBe(true);
  });
});
