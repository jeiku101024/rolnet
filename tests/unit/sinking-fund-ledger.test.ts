import { describe, expect, it } from "vitest";
import { findNegativeFund, findNegativeSavings, fundAt, negativeSavingsMessage, savingsAt } from "@/lib/sinking-fund/ledger";
import { formatPesos } from "@/lib/money/centavos";
import { deposit, interestShare, loan, loanWithdrawal, payment, peso, savingsWithdrawal, voided } from "../support/sf-fixtures";

describe("worked example A (default: take interest first)", () => {
  const d = deposit("a", "2026-11-01", peso(10000));
  const l = loan("a", "2026-11-03", peso(2000));
  const p1 = payment("a", l, "2026-11-04", peso(500), peso(100));

  it("tracks savings and the Interest fund step by step", () => {
    expect(savingsAt([d])).toBe(peso(10000));
    expect(savingsAt([d, l])).toBe(peso(8000));
    expect(savingsAt([d, l, p1])).toBe(peso(8400));
    expect(fundAt([d, l, p1], [])).toBe(peso(100));
  });

  it("4a: paying the rest as principal returns savings to ₱10,000", () => {
    const p2 = payment("a", l, "2026-11-05", peso(1600), 0);
    expect(savingsAt([d, l, p1, p2])).toBe(peso(10000));
    expect(fundAt([d, l, p1, p2], [])).toBe(peso(100));
  });

  it("4b: a loan Withdrawal leaves savings at ₱8,400 and the fund at ₱100", () => {
    const w = loanWithdrawal("a", l, "2026-12-10", peso(1600), 0);
    expect(savingsAt([d, l, p1, w])).toBe(peso(8400));
    expect(fundAt([d, l, p1, w], [])).toBe(peso(100));
  });
});

describe("worked example B (owner takes the interest on the second payment)", () => {
  const d = deposit("a", "2026-11-01", peso(10000));
  const l = loan("a", "2026-11-03", peso(2000));
  const p1 = payment("a", l, "2026-11-04", peso(500), 0);
  const p2 = payment("a", l, "2026-11-05", peso(1000), peso(100));
  const p3 = payment("a", l, "2026-11-06", peso(600), 0);

  it("matches every row of the table", () => {
    expect([savingsAt([d, l, p1]), fundAt([d, l, p1], [])]).toEqual([peso(8500), 0]);
    expect([savingsAt([d, l, p1, p2]), fundAt([d, l, p1, p2], [])]).toEqual([peso(9400), peso(100)]);
    expect([savingsAt([d, l, p1, p2, p3]), fundAt([d, l, p1, p2, p3], [])]).toEqual([peso(10000), peso(100)]);
  });

  it("closing as a withdrawal after step 3 keeps ₱8,500 and waives the ₱100 interest", () => {
    const w = loanWithdrawal("a", l, "2026-12-10", peso(1600), peso(100));
    expect(savingsAt([d, l, p1, w])).toBe(peso(8500));
    expect(fundAt([d, l, p1, w], [])).toBe(0);
  });
});

describe("back-dated entries (savings never negative on any date)", () => {
  const nov1 = deposit("ana", "2026-11-01", peso(1000));
  const nov10 = deposit("ana", "2026-11-10", peso(5000));

  it("blocks a ₱3,000 loan dated Nov 5 and names the date and ₱1,000", () => {
    const found = findNegativeSavings([nov1, nov10, loan("ana", "2026-11-05", peso(3000))]);
    expect(found).toMatchObject({ date: "2026-11-05", availableCentavos: peso(1000) });
    expect(negativeSavingsMessage("Ana", found!, formatPesos)).toBe("Ana only had ₱1,000.00 on Nov 5, 2026.");
  });

  it("allows an ₱800 loan dated Nov 5", () => {
    expect(findNegativeSavings([nov1, nov10, loan("ana", "2026-11-05", peso(800))])).toBeNull();
  });

  it("orders same-day credits before debits, so a deposit and loan on one day work in any entry order", () => {
    const sameDayLoan = loan("ana", "2026-11-01", peso(1000));
    expect(findNegativeSavings([sameDayLoan, nov1])).toBeNull();
  });

  it("blocks voiding a deposit that a later withdrawal depends on", () => {
    const w = savingsWithdrawal("ana", "2026-11-12", peso(5000));
    expect(findNegativeSavings([nov1, voided(nov10), w])).toMatchObject({ date: "2026-11-12" });
    expect(findNegativeSavings([nov1, nov10, w])).toBeNull();
  });

  it("ignores voided rows", () => {
    expect(findNegativeSavings([nov1, voided(loan("ana", "2026-11-05", peso(3000)))])).toBeNull();
  });

  it("allows withdrawing the full balance to ₱0", () => {
    expect(findNegativeSavings([nov1, savingsWithdrawal("ana", "2026-11-02", peso(1000))])).toBeNull();
    expect(savingsAt([nov1, savingsWithdrawal("ana", "2026-11-02", peso(1000))])).toBe(0);
  });
});

describe("Interest fund timeline", () => {
  const d = deposit("a", "2026-11-01", peso(10000));
  const l = loan("a", "2026-11-03", peso(2000));
  const p = payment("a", l, "2026-11-04", peso(500), peso(100));
  const distribution = { id: "dist-1", dist_date: "2026-11-10", total_distributed_centavos: peso(100), voided_at: null };

  it("blocks reducing an interest part after it was distributed", () => {
    const reduced = { ...p, interest_part_centavos: 0, principal_part_centavos: peso(500) };
    expect(findNegativeFund([d, l, reduced], [distribution])).toMatchObject({ date: "2026-11-10" });
    expect(findNegativeFund([d, l, p], [distribution])).toBeNull();
  });

  it("subtracts distributions from the fund", () => {
    expect(fundAt([d, l, p], [distribution])).toBe(0);
    expect(fundAt([d, l, p], [{ ...distribution, voided_at: "2026-11-11T00:00:00Z" }])).toBe(peso(100));
  });

  it("credits interest shares to savings", () => {
    expect(savingsAt([d, interestShare("a", "2026-11-10", peso(33.33), "dist-1")])).toBe(peso(10033.33));
  });
});
