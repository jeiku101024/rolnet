import { describe, expect, it } from "vitest";
import { fleetToday } from "@/lib/dates/fleet-date";
import { findNegativeFund, findNegativeSavings } from "@/lib/sinking-fund/ledger";
import { buildLoans, fundSummary, ledgerRows, monthlyFlows, participantSummaries, rankingFor } from "@/lib/sinking-fund/aggregate";
import { demoSfData } from "@/lib/sinking-fund/demo-data";

const today = fleetToday();

describe("demo ledger", () => {
  it("has enough rows for Load more and never goes negative on any date", () => {
    expect(demoSfData.transactions.filter((row) => !row.voided_at).length).toBeGreaterThanOrEqual(30);
    for (const participant of demoSfData.participants) {
      expect(findNegativeSavings(demoSfData.transactions.filter((row) => row.participant_id === participant.id))).toBeNull();
    }
    expect(findNegativeFund(demoSfData.transactions, demoSfData.distributions)).toBeNull();
  });

  it("shows every loan status", () => {
    const statuses = new Set(buildLoans(demoSfData, today).map((loan) => (loan.overdue ? "overdue" : loan.status)));
    expect([...statuses].sort()).toEqual(["open", "overdue", "paid", "withdrawn"]);
  });

  it("totals add up", () => {
    const summary = fundSummary(demoSfData, today);
    const cards = participantSummaries(demoSfData, today);
    expect(cards.reduce((sum, card) => sum + card.savings_centavos, 0)).toBe(summary.total_savings_centavos);
    expect(summary.interest_available_centavos).toBe(1); // ₱250.00 collected, ₱249.99 distributed
    expect(summary.participant_count).toBe(7);
    expect(cards.some((card) => card.has_overdue)).toBe(true);
  });

  it("leaves the archived participant out of cards and rankings", () => {
    expect(participantSummaries(demoSfData, today).map((card) => card.name)).not.toContain("Iris Ortiz");
    expect(rankingFor(demoSfData, "savings", null, null).map((row) => row.name)).not.toContain("Iris Ortiz");
  });

  it("builds six months of flows and ledger rows with savings after", () => {
    expect(monthlyFlows(demoSfData, 6, today)).toHaveLength(6);
    const rows = ledgerRows(demoSfData, today);
    expect(rows).toHaveLength(demoSfData.transactions.length);
    expect(rows.every((row) => row.savings_after_centavos !== null)).toBe(true);
  });
});
