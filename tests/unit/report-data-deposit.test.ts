import { describe, expect, it } from "vitest";
import { addDays, fleetToday } from "@/lib/dates/fleet-date";
import { demoRemittances } from "@/lib/demo/mode";
import { loadDailyData, loadYearlyData } from "@/lib/reports/report-data";

// Feature 020: the report reads the recorded deposit (payments minus allowance), not Rental minus Allowance. Demo mode reads the
// demo rows, which carry the same deposit_centavos the List view shows.

const today = fleetToday();
const range = { from: addDays(today, -13), to: today };

describe("daily report data carries the recorded deposit (feature 020)", () => {
  it("gives every remittance its stored deposit, equal to payments minus allowance", async () => {
    const data = await loadDailyData(null, range, null);
    const rows = [...data.values()].flatMap((unit) => unit.remittances);
    expect(rows.length).toBeGreaterThan(5);
    for (const [unitId, unit] of data) {
      for (const item of unit.remittances) {
        const source = demoRemittances.find((row) => row.unit_id === unitId && row.service_date === item.date)!;
        expect(item.depositCentavos).toBe(source.deposit_centavos);
        expect(item.depositCentavos).toBe(source.remittance_payments.reduce((sum, payment) => sum + payment.amount_centavos, 0) - source.allowance_centavos);
      }
    }
  });

  it("shows an unpaid remittance as minus the allowance, not Rental minus Allowance", async () => {
    const data = await loadDailyData(null, { from: addDays(today, -40), to: today }, null);
    const unpaid = [...data.values()].flatMap((unit) => unit.remittances).filter((item) => item.depositCentavos === -4000);
    expect(unpaid.length).toBeGreaterThan(0);
    expect(unpaid.every((item) => item.rentalCentavos - item.allowanceCentavos !== item.depositCentavos)).toBe(true);
  });

  it("has no late payments in the demo data, which has no payment dates", async () => {
    const data = await loadDailyData(null, range, null);
    expect([...data.values()].flatMap((unit) => unit.remittances).every((item) => item.latePayments.length === 0)).toBe(true);
  });
});

describe("yearly report data carries the month deposit (feature 020)", () => {
  it("adds each unit month's stored deposits", async () => {
    const year = Number(today.slice(0, 4));
    const data = await loadYearlyData(null, year, null);
    for (const [unitId, unit] of data) {
      for (const [index, month] of unit.months.entries()) {
        const expected = demoRemittances
          .filter((row) => row.unit_id === unitId && row.service_date.startsWith(`${year}-${String(index + 1).padStart(2, "0")}`))
          .reduce((sum, row) => sum + row.deposit_centavos, 0);
        expect(month.depositCentavos).toBe(expected);
      }
    }
  });
});
