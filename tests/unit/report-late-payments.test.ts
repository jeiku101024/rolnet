import { describe, expect, it } from "vitest";
import { lateNote, latePaymentsFor } from "@/lib/reports/late-payments";

// Feature 020 (spec FR-014): which payments are late and how the Notes cell reads.

const payment = (paidAt: string, amount = 18000) => ({ paid_at: paidAt, amount_centavos: amount });

describe("latePaymentsFor", () => {
  it("keeps a payment dated the day after the service date", () => {
    expect(latePaymentsFor("2026-11-17", [payment("2026-11-18T02:00:00Z")])).toEqual([{ date: "2026-11-18", amountCentavos: 18000 }]);
  });

  it("does not count a payment on the service date or before it", () => {
    expect(latePaymentsFor("2026-11-17", [payment("2026-11-17T04:00:00Z"), payment("2026-11-16T04:00:00Z")])).toEqual([]);
  });

  it("dates a payment by its Manila day, not its UTC day", () => {
    // 23:30 Manila on Nov 17 is 15:30 UTC on Nov 17: same day as the service date, so not late.
    expect(latePaymentsFor("2026-11-17", [payment("2026-11-17T15:30:00Z")])).toEqual([]);
    // 00:30 Manila on Nov 18 is 16:30 UTC on Nov 17: already the next Manila day, so late.
    expect(latePaymentsFor("2026-11-17", [payment("2026-11-17T16:30:00Z")])).toEqual([{ date: "2026-11-18", amountCentavos: 18000 }]);
  });

  it("returns several late payments oldest first", () => {
    const late = latePaymentsFor("2026-11-17", [payment("2026-11-22T04:00:00Z", 100), payment("2026-11-19T04:00:00Z", 200)]);
    expect(late.map((item) => item.date)).toEqual(["2026-11-19", "2026-11-22"]);
  });
});

describe("lateNote", () => {
  it("is empty when nothing is late", () => {
    expect(lateNote([])).toBe("");
  });

  it("names one late payment with its amount and date", () => {
    expect(lateNote([{ date: "2026-11-22", amountCentavos: 18000 }])).toBe("Received later: ₱180.00 on Nov 22");
  });

  it("summarizes several late payments with the count, the total and the latest date", () => {
    expect(lateNote([
      { date: "2026-11-19", amountCentavos: 18000 },
      { date: "2026-11-20", amountCentavos: 18000 },
      { date: "2026-11-22", amountCentavos: 18000 },
    ])).toBe("Received later: 3 payments, ₱540.00 (last Nov 22)");
  });

  it("prints centavos with two decimals", () => {
    expect(lateNote([{ date: "2026-11-22", amountCentavos: 12550 }])).toBe("Received later: ₱125.50 on Nov 22");
  });
});
