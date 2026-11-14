import { describe, expect, it } from "vitest";
import { formatDistributionToast, formatLoanToast, formatPaymentToast } from "@/lib/sinking-fund/messages";

describe("sinking fund toasts (spec section 6)", () => {
  it("shows the loan with whole pesos and the due day", () => {
    expect(formatLoanToast(210000, "2026-12-03")).toBe("Loan recorded. To pay ₱2,100 by Dec 3");
  });

  it("shows the balance, or that the loan is fully paid", () => {
    expect(formatPaymentToast(160000)).toBe("Payment recorded. Balance ₱1,600");
    expect(formatPaymentToast(0)).toBe("Payment recorded. Loan fully paid");
    expect(formatPaymentToast(150050)).toBe("Payment recorded. Balance ₱1,500.50");
  });

  it("says how many participants share the interest", () => {
    expect(formatDistributionToast(9999, 3)).toBe("₱99.99 distributed to 3 participants. Year closed. Everyone starts again from ₱0.00.");
    expect(formatDistributionToast(5000, 1)).toBe("₱50 distributed to 1 participant. Year closed. Everyone starts again from ₱0.00.");
  });
});
