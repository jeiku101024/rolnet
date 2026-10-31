import { describe, expect, it } from "vitest";
import { ALLOWANCE_CENTAVOS, depositFor, exceedsRental, overRentalMessage } from "@/lib/remittances/financials";

describe("remittance financials (feature 009)", () => {
  it("keeps a fixed ₱40 allowance and deposits the rest, possibly negative", () => {
    expect(ALLOWANCE_CENTAVOS).toBe(4000);
    expect(depositFor(18000)).toBe(14000);
    expect(depositFor(10000)).toBe(6000);
    expect(depositFor(0)).toBe(-4000);
    expect(depositFor(10000, 3000)).toBe(7000);
  });

  it("blocks payments above the rental", () => {
    expect(exceedsRental(18001, 18000)).toBe(true);
    expect(exceedsRental(18000, 18000)).toBe(false);
    expect(overRentalMessage(18000)).toBe("Payment can't exceed the rental of ₱180.00");
  });
});
