import { describe, expect, it } from "vitest";
import { fleetToday } from "@/lib/dates/fleet-date";
import { findNegativeFund, findNegativeSavings } from "@/lib/sinking-fund/ledger";
import { buildLoans, cycleStart, distributionDetail, fundSummary, ledgerRows, monthlyFlows, participantSummaries, rankingFor } from "@/lib/sinking-fund/aggregate";
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
    expect(summary.interest_available_centavos).toBe(4000); // ₱250.00 collected, ₱150.00 shared at the year-end close, ₱60.00 in the older equal shares
    expect(summary.participant_count).toBe(7);
    expect(cards.some((card) => card.has_overdue)).toBe(true);
  });

  it("closes the year for the ticked participants only: their savings restart and the cards count the new cycle", () => {
    const close = demoSfData.distributions.find((item) => item.per_participant_centavos === null)!;
    expect(cycleStart(demoSfData)).toBe(close.dist_date);
    const savings = (name: string) => participantSummaries(demoSfData, today).find((card) => card.name === name)!.savings_centavos;
    // Felix's ended total was zeroed at the close, then he deposited ₱500.00 and withdrew ₱300.00 afterwards.
    expect(savings("Felix Tan")).toBe(20000);
    const summary = fundSummary(demoSfData, today);
    expect(summary.cycle_start).toBe(close.dist_date);
    // Payments received count only after the cycle start: Ben's ₱550.00 and Ana's ₱400.00 payments.
    expect(summary.payments_received_centavos).toBe(55000 + 40000);
    expect(summary.interest_collected_centavos).toBe(5000 + 5000);
  });

  it("keeps the saved table of a closed distribution sorted highest first with a ₱0 participant", () => {
    const close = demoSfData.distributions.find((item) => item.per_participant_centavos === null)!;
    const detail = distributionDetail(demoSfData, close.id)!;
    expect(detail.rows.map((row) => row.participant_name)).toEqual(["Dino Lim", "Felix Tan", "Hugo Dela Cruz"]);
    const hugo = detail.rows.at(-1)!;
    expect(hugo).toMatchObject({ savings_before_centavos: 0, share_centavos: 0, ended_total_centavos: 0 });
    expect(detail.totals.share_centavos).toBe(close.total_distributed_centavos);
    expect(detail.totals.ended_total_centavos).toBe(detail.rows.reduce((sum, row) => sum + (row.ended_total_centavos ?? 0), 0));
  });

  it("shows an older equal-share distribution with its shares and no ended totals", () => {
    const older = demoSfData.distributions.find((item) => item.per_participant_centavos !== null)!;
    const detail = distributionDetail(demoSfData, older.id)!;
    expect(detail.rows).toHaveLength(3);
    expect(detail.rows.every((row) => row.ended_total_centavos === null && row.share_centavos === 2000)).toBe(true);
    expect(detail.totals.ended_total_centavos).toBeNull();
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
