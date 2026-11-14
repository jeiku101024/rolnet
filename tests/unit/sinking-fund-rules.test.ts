import { describe, expect, it } from "vitest";
import { allowedInterestRange, defaultInterestPart, isLoanStep, loanAmountDue, loanDueDate, loanInterest, loanState, proportionalShares, splitPayment } from "@/lib/sinking-fund/rules";
import { deposit, loan, loanWithdrawal, payment, peso } from "../support/sf-fixtures";

describe("loan terms", () => {
  it("charges 5% as a whole-peso interest", () => {
    expect(loanInterest(peso(2000))).toBe(peso(100));
    expect(loanAmountDue(peso(2000))).toBe(peso(2100));
    expect(loanInterest(peso(100))).toBe(peso(5));
  });

  it("accepts only positive steps of ₱100", () => {
    expect(isLoanStep(peso(100))).toBe(true);
    expect(isLoanStep(peso(300))).toBe(true);
    expect(isLoanStep(peso(150))).toBe(false);
    expect(isLoanStep(0)).toBe(false);
    expect(isLoanStep(peso(0.5))).toBe(false);
  });

  it.each([
    ["2026-11-03", "2026-12-03"],
    ["2026-01-31", "2026-02-28"],
    ["2028-01-31", "2028-02-29"],
    ["2026-12-15", "2027-01-15"],
    ["2026-03-31", "2026-04-30"],
  ])("due date for a loan on %s is %s", (date, due) => expect(loanDueDate(date)).toBe(due));
});

describe("allowed interest range and default prefill", () => {
  it("allows 0 to ₱100 on the first ₱500 payment of a fresh ₱2,100 loan, with ₱2,000 principal", () => {
    expect(allowedInterestRange(peso(500), peso(100), peso(2000))).toEqual({ min: 0, max: peso(100) });
  });

  it("forces interest once the principal is nearly repaid", () => {
    // Unpaid principal ₱300, unpaid interest ₱100, payment ₱400: the whole interest is due.
    expect(allowedInterestRange(peso(400), peso(100), peso(300))).toEqual({ min: peso(100), max: peso(100) });
  });

  it("caps the interest part at the payment amount", () => {
    expect(allowedInterestRange(peso(50), peso(100), peso(2000))).toEqual({ min: 0, max: peso(50) });
  });

  it("prefills the largest part for 'first' and the smallest for 'last'", () => {
    const range = { min: 0, max: peso(100) };
    expect(defaultInterestPart("first", range)).toBe(peso(100));
    expect(defaultInterestPart("last", range)).toBe(0);
  });

  it("splits a payment", () => expect(splitPayment(peso(500), peso(100))).toEqual({ interest: peso(100), principal: peso(400) }));
});

describe("distribution shares (proportional to savings)", () => {
  const person = (id: string, pesos: number) => ({ id, savingsCentavos: peso(pesos) });

  it("shares ₱300 as ₱50, ₱100, and ₱150 for savings of ₱1,000, ₱2,000, and ₱3,000", () => {
    const result = proportionalShares(peso(300), [person("a", 1000), person("b", 2000), person("c", 3000)]);
    expect([...result.shares.values()]).toEqual([peso(50), peso(100), peso(150)]);
    expect(result).toMatchObject({ total: peso(300), remainder: 0, overall: peso(6000) });
  });

  it("rounds each share down and keeps the leftover centavos in the fund", () => {
    const result = proportionalShares(peso(100), [person("a", 10), person("b", 10), person("c", 10)]);
    expect([...result.shares.values()]).toEqual([3333, 3333, 3333]);
    expect(result.remainder).toBe(1);
    expect(result.total + result.remainder).toBe(peso(100));
  });

  it("gives equal shares only to equal savings", () => {
    const result = proportionalShares(peso(100), [person("a", 10), person("b", 30)]);
    expect(result.shares.get("a")).toBe(peso(25));
    expect(result.shares.get("b")).toBe(peso(75));
  });

  it("gives a participant with no savings no share", () => {
    const result = proportionalShares(peso(100), [person("a", 0), person("b", 500)]);
    expect(result.shares.get("a")).toBe(0);
    expect(result.shares.get("b")).toBe(peso(100));
  });

  it("gives nothing when nobody has savings or the fund is empty", () => {
    expect(proportionalShares(peso(100), [person("a", 0), person("b", 0)])).toMatchObject({ total: 0, remainder: peso(100), overall: 0 });
    expect(proportionalShares(0, [person("a", 100)])).toMatchObject({ total: 0, remainder: 0 });
    expect(proportionalShares(peso(100), [])).toMatchObject({ total: 0, remainder: peso(100) });
  });

  it("keeps full precision for large funds", () => {
    const fund = 9_000_000_000_000; // ₱90 billion in centavos, beyond float-safe multiplication
    const result = proportionalShares(fund, [{ id: "a", savingsCentavos: 3_000_000_000_001 }, { id: "b", savingsCentavos: 6_000_000_000_001 }]);
    expect(result.total + result.remainder).toBe(fund);
    expect(result.remainder).toBeLessThan(2);
  });
});

describe("loan state", () => {
  const today = "2026-11-13";

  it("is open with the full balance before any payment", () => {
    const l = loan("a", "2026-11-03", peso(2000));
    expect(loanState(l, [l], today)).toMatchObject({ status: "open", balance_centavos: peso(2100), unpaid_interest_centavos: peso(100), unpaid_principal_centavos: peso(2000), due_date: "2026-12-03", overdue: false });
  });

  it("becomes overdue the day after the due date while a balance remains", () => {
    const l = loan("a", "2026-10-03", peso(2000));
    expect(loanState(l, [l], "2026-11-03").overdue).toBe(false);
    expect(loanState(l, [l], "2026-11-04").overdue).toBe(true);
  });

  it("is paid when interest and principal are both fully repaid (worked example A)", () => {
    const l = loan("a", "2026-11-03", peso(2000));
    const p1 = payment("a", l, "2026-11-04", peso(500), peso(100));
    const p2 = payment("a", l, "2026-11-05", peso(1600), 0);
    expect(loanState(l, [deposit("a", "2026-11-01", peso(10000)), l, p1], today)).toMatchObject({ balance_centavos: peso(1600), status: "open" });
    expect(loanState(l, [l, p1, p2], today)).toMatchObject({ balance_centavos: 0, status: "paid", interest_paid_centavos: peso(100), principal_paid_centavos: peso(2000) });
  });

  it("closes as withdrawn with balance 0 (worked example A step 4b)", () => {
    const l = loan("a", "2026-10-03", peso(2000));
    const p1 = payment("a", l, "2026-10-04", peso(500), peso(100));
    const w = loanWithdrawal("a", l, "2026-11-10", peso(1600), 0);
    expect(loanState(l, [l, p1, w], today)).toMatchObject({ status: "withdrawn", balance_centavos: 0, withdrawn_on: "2026-11-10", overdue: false });
  });

  it("ignores voided payments", () => {
    const l = loan("a", "2026-11-03", peso(2000));
    const p = { ...payment("a", l, "2026-11-04", peso(500), peso(100)), voided_at: "2026-11-05T00:00:00Z" };
    expect(loanState(l, [l, p], today).balance_centavos).toBe(peso(2100));
  });
});
