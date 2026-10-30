import { describe, expect, it } from "vitest";
import { fleetToday } from "@/lib/dates/fleet-date";
import { dailyCollections, monthTotals, unitIncomeBars } from "@/lib/dashboard/ordering";

const summary = [
  { unit_id: "2", body_number: "T-002", remittance_paid_centavos: 360000, total_expense_centavos: 185050, net_income_centavos: 174950 },
  { unit_id: "1", body_number: "T-001", remittance_paid_centavos: 540000, total_expense_centavos: 0, net_income_centavos: 540000 },
];

describe("dashboard month figures (feature 006)", () => {
  it("sums the monthly unit summary in whole centavos", () => {
    expect(monthTotals(summary)).toEqual({ collectedCentavos: 900000, expenseCentavos: 185050, netCentavos: 714950 });
    expect(monthTotals(summary).netCentavos).toBe(summary.reduce((sum, row) => sum + row.net_income_centavos, 0));
  });

  it("scales the per-unit bars to the largest value and orders units by body number", () => {
    const bars = unitIncomeBars(summary);
    expect(bars.map((bar) => bar.bodyNumber)).toEqual(["T-001", "T-002"]);
    expect(bars[0]).toMatchObject({ collectedPct: 100, expensePct: 0, netCentavos: 540000 });
    expect(bars[1]).toMatchObject({ collectedPct: 67, expensePct: 34 });
  });

  it("shows zeros without dividing by zero in an empty month", () => {
    expect(monthTotals([])).toEqual({ collectedCentavos: 0, expenseCentavos: 0, netCentavos: 0 });
    expect(unitIncomeBars([{ unit_id: "1", body_number: "T-001", remittance_paid_centavos: null, total_expense_centavos: null, net_income_centavos: null }])[0]).toMatchObject({ collectedPct: 0, expensePct: 0 });
    const days = dailyCollections([], "2026-10", "2026-10-03", (paidAt) => paidAt.slice(0, 10));
    expect(days.map((day) => day.heightPct)).toEqual([0, 0, 0]);
  });

  it("buckets payments by the Manila day, so 23:30 UTC belongs to the next day", () => {
    const manila = (paidAt: string) => fleetToday(new Date(paidAt));
    const payments = [
      { paid_at: "2026-10-01T23:30:00Z", amount_centavos: 18000 },
      { paid_at: "2026-10-02T01:00:00Z", amount_centavos: 30000 },
      { paid_at: "2026-09-30T15:59:00Z", amount_centavos: 99900 },
      { paid_at: "2026-09-30T16:00:00Z", amount_centavos: 18000 },
    ];
    const days = dailyCollections(payments, "2026-10", "2026-10-02", manila);
    expect(days).toEqual([
      { date: "2026-10-01", collectedCentavos: 18000, heightPct: 38 },
      { date: "2026-10-02", collectedCentavos: 48000, heightPct: 100 },
    ]);
    expect(days.reduce((sum, day) => sum + day.collectedCentavos, 0)).toBe(66000);
  });
});
