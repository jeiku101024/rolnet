import { describe, expect, it } from "vitest";
import {
  activeSummary, barShares, closedPageSize, closedView, closedYears, daysLeft, dueText, paymentsByLoan, percentPaid, shownBalance, sortActive, sortClosed, splitLoans,
} from "@/lib/sinking-fund/loan-list";
import type { SfLoan, SfLoanPayment } from "@/lib/sinking-fund/types";

let n = 0;
function loan(over: Partial<SfLoan> = {}): SfLoan {
  n += 1;
  return {
    id: `loan-${String(n).padStart(3, "0")}`, participant_id: "p1", loan_date: "2026-10-01", principal_centavos: 100000, interest_centavos: 5000, amount_due_centavos: 105000,
    due_date: "2026-11-01", interest_paid_centavos: 0, principal_paid_centavos: 0, unpaid_interest_centavos: 5000, unpaid_principal_centavos: 100000, balance_centavos: 105000,
    status: "open", overdue: false, withdrawn_on: null, updated_at: "2026-10-01T00:00:00Z", ...over,
  };
}

describe("loan list rules", () => {
  it("splits active from paid and withdrawn loans", () => {
    const { active, closed } = splitLoans([loan(), loan({ status: "paid", balance_centavos: 0 }), loan({ status: "withdrawn", balance_centavos: 0 })]);
    expect(active).toHaveLength(1);
    expect(closed.map((item) => item.status)).toEqual(["paid", "withdrawn"]);
  });

  it("orders active loans overdue first, then nearest due date, then oldest", () => {
    const later = loan({ due_date: "2026-12-30" });
    const soon = loan({ due_date: "2026-12-01" });
    const lateOverdue = loan({ due_date: "2026-11-20", overdue: true });
    const earlyOverdue = loan({ due_date: "2026-10-20", overdue: true });
    const tieNew = loan({ due_date: "2026-12-01", loan_date: "2026-11-01" });
    const ids = sortActive([later, tieNew, soon, lateOverdue, earlyOverdue]).map((item) => item.id);
    expect(ids).toEqual([earlyOverdue.id, lateOverdue.id, soon.id, tieNew.id, later.id]);
  });

  it("orders closed loans newest first", () => {
    const a = loan({ loan_date: "2026-01-01" });
    const b = loan({ loan_date: "2026-06-01" });
    expect(sortClosed([a, b]).map((item) => item.id)).toEqual([b.id, a.id]);
  });

  it("counts whole days to the due date", () => {
    expect(daysLeft("2026-11-30", "2026-11-23")).toBe(7);
    expect(daysLeft("2026-11-23", "2026-11-23")).toBe(0);
    expect(daysLeft("2026-10-20", "2026-11-23")).toBe(-34);
  });

  it("words the due date and marks what is soon or overdue", () => {
    expect(dueText(-34)).toEqual({ text: "Overdue by 34 days", tone: "overdue" });
    expect(dueText(-1)).toEqual({ text: "Overdue by 1 day", tone: "overdue" });
    expect(dueText(0)).toEqual({ text: "Due today", tone: "soon" });
    expect(dueText(1)).toEqual({ text: "1 day left", tone: "soon" });
    expect(dueText(7)).toEqual({ text: "7 days left", tone: "soon" });
    expect(dueText(22)).toEqual({ text: "22 days left", tone: "normal" });
  });

  it("summarises the active loans", () => {
    const summary = activeSummary([loan({ balance_centavos: 105000, overdue: true }), loan({ balance_centavos: 50000 })]);
    expect(summary).toEqual({ count: 2, balanceCentavos: 155000, overdue: 1 });
    expect(activeSummary([])).toEqual({ count: 0, balanceCentavos: 0, overdue: 0 });
  });

  it("computes percent paid and bar shares without going past 100", () => {
    const half = loan({ interest_paid_centavos: 5000, principal_paid_centavos: 47500 });
    expect(percentPaid(half)).toBe(50);
    const shares = barShares(half);
    expect(shares.interest).toBeCloseTo(4.76, 1);
    expect(shares.interest + shares.principal).toBeCloseTo(50, 5);
    expect(percentPaid(loan({ amount_due_centavos: 0 }))).toBe(0);
    expect(barShares(loan({ amount_due_centavos: 0 }))).toEqual({ interest: 0, principal: 0 });
    expect(percentPaid(loan({ interest_paid_centavos: 9000, principal_paid_centavos: 120000 }))).toBe(100);
  });

  it("never shows a balance below zero", () => {
    expect(shownBalance(loan({ balance_centavos: -500 }))).toBe(0);
    expect(shownBalance(loan({ balance_centavos: 0 }))).toBe(0);
    expect(shownBalance(loan({ balance_centavos: 1234 }))).toBe(1234);
  });

  it("groups payments by loan, keeping their order", () => {
    const pay = (id: string, loanId: string): SfLoanPayment => ({ id, loan_id: loanId, tx_date: "2026-11-01", amount_centavos: 100, interest_part_centavos: 40, principal_part_centavos: 60 });
    const map = paymentsByLoan([pay("a", "L1"), pay("b", "L2"), pay("c", "L1")]);
    expect(map.get("L1")?.map((item) => item.id)).toEqual(["a", "c"]);
    expect(map.get("L2")?.map((item) => item.id)).toEqual(["b"]);
  });

  describe("paid and closed list", () => {
    const closed = [
      ...Array.from({ length: 9 }, (_, i) => loan({ status: "paid", balance_centavos: 0, loan_date: `2026-0${(i % 9) + 1}-10` })),
      ...Array.from({ length: 4 }, (_, i) => loan({ status: "paid", balance_centavos: 0, loan_date: `2025-0${i + 5}-10` })),
      loan({ status: "withdrawn", balance_centavos: 0, loan_date: "2026-10-01" }),
    ];

    it("lists years newest first", () => {
      expect(closedYears(closed)).toEqual(["2026", "2025"]);
    });

    it("pages 14 loans into three pages of five", () => {
      expect(closedPageSize).toBe(5);
      const first = closedView(closed, "all", 1);
      expect(first.rows).toHaveLength(5);
      expect(first).toMatchObject({ page: 1, lastPage: 3, total: 14, rangeLabel: "1 to 5 of 14" });
      expect(closedView(closed, "all", 3).rows).toHaveLength(4);
      expect(closedView(closed, "all", 2).rows[0].id).not.toBe(first.rows[0].id);
    });

    it("clamps a page past the end or below one", () => {
      expect(closedView(closed, "all", 99).page).toBe(3);
      expect(closedView(closed, "all", 0).page).toBe(1);
      expect(closedView(closed, "all", Number.NaN).page).toBe(1);
    });

    it("filters by year and leaves withdrawn loans out of the repaid total", () => {
      const year = closedView(closed, "2025", 1);
      expect(year.total).toBe(4);
      expect(year.repaidCentavos).toBe(4 * 105000);
      const all = closedView(closed, "all", 1);
      expect(all.repaidCentavos).toBe(13 * 105000);
    });

    it("reports an empty list", () => {
      expect(closedView([], "all", 1)).toMatchObject({ rows: [], total: 0, page: 1, lastPage: 1, rangeLabel: "0 loans", repaidCentavos: 0 });
    });
  });
});
