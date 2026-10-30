import { describe, expect, it } from "vitest";
import { planPaymentChange } from "@/lib/remittances/payment-plan";

describe("planPaymentChange (feature 008, FR-027)", () => {
  it("does nothing when the total is unchanged", () => {
    expect(planPaymentChange({ currentCentavos: 18000, targetCentavos: 18000, isOwner: false })).toEqual({ kind: "none" });
  });

  it("adds the difference when the total goes up, for anyone", () => {
    for (const isOwner of [true, false]) {
      expect(planPaymentChange({ currentCentavos: 10000, targetCentavos: 18000, isOwner })).toEqual({ kind: "add", amountCentavos: 8000 });
    }
  });

  it("lets only the owner lower the total", () => {
    expect(planPaymentChange({ currentCentavos: 18000, targetCentavos: 10000, isOwner: true })).toEqual({ kind: "replace", targetCentavos: 10000 });
    expect(planPaymentChange({ currentCentavos: 18000, targetCentavos: 10000, isOwner: false })).toEqual({ kind: "blocked" });
  });

  it("plans voids only when the owner lowers the total to zero", () => {
    expect(planPaymentChange({ currentCentavos: 18000, targetCentavos: 0, isOwner: true })).toEqual({ kind: "replace", targetCentavos: 0 });
  });

  it("rejects negative or fractional centavos", () => {
    expect(() => planPaymentChange({ currentCentavos: 0, targetCentavos: -1, isOwner: true })).toThrow();
    expect(() => planPaymentChange({ currentCentavos: 0, targetCentavos: 1.5, isOwner: true })).toThrow();
  });
});
