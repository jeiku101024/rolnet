import { describe, expect, it } from "vitest";
import { standingsFor, type SfData } from "@/lib/sinking-fund/aggregate";
import { rankRows } from "@/lib/sinking-fund/rankings";
import type { SfParticipant } from "@/lib/sinking-fund/types";
import { deposit, loan, loanWithdrawal, payment, peso, voided } from "@/tests/support/sf-fixtures";

// Feature 019: the TypeScript twin of sf_standings, pinned to the same worked cases as the pgTAP file (450).

const person = (id: string, created: string, archived: string | null = null): SfParticipant => ({ id, name: id, driver_id: null, notes: null, archived_at: archived, created_at: `${created}T12:00:00Z`, updated_at: `${created}T12:00:00Z` });
const anaLoan = loan("Ana", "2026-01-10", peso(2000));
const boLoan = loan("Bo", "2026-01-20", peso(1000));
const floLoan = loan("Flo", "2026-01-10", peso(1000));
const data: SfData = {
  participants: [person("Ana", "2026-01-01"), person("Bo", "2026-01-01"), person("Cy", "2026-02-20"), person("Dee", "2026-01-01", "2026-03-01"), person("Eve", "2026-01-01"), person("Flo", "2026-01-01")],
  transactions: [
    deposit("Ana", "2026-01-05", peso(10000)), deposit("Bo", "2026-01-05", peso(5000)), deposit("Cy", "2026-02-21", peso(10)), deposit("Dee", "2026-01-05", peso(90)),
    deposit("Eve", "2026-01-06", peso(500)), voided(deposit("Eve", "2026-01-07", peso(1000))), deposit("Flo", "2026-01-05", peso(3000)),
    anaLoan, boLoan, floLoan,
    payment("Ana", anaLoan, "2026-03-01", peso(500), peso(100)),
    payment("Flo", floLoan, "2026-02-05", peso(1050), peso(50)),
    loanWithdrawal("Bo", boLoan, "2026-02-01", peso(1050), peso(50)),
  ],
  distributions: [],
};
const row = (asOf: string, name: string) => standingsFor(data, asOf).find((item) => item.name === name);

describe("standingsFor (feature 019)", () => {
  it("leaves out archived and later-joined participants", () => {
    expect(standingsFor(data, "2026-01-31").map((item) => item.name)).toEqual(["Ana", "Bo", "Eve", "Flo"]);
    expect(standingsFor(data, "2026-03-15").map((item) => item.name)).toEqual(["Ana", "Bo", "Cy", "Eve", "Flo"]);
    expect(standingsFor(data, "2025-12-31")).toEqual([]);
  });

  it("gives savings, open loan principal and the unpaid balance as of the date", () => {
    expect(row("2026-01-31", "Ana")).toMatchObject({ savings_centavos: peso(8000), loans_centavos: peso(2000), balance_to_pay_centavos: peso(2100), has_overdue: false });
    expect(row("2026-03-15", "Ana")).toMatchObject({ savings_centavos: peso(8400), loans_centavos: peso(2000), balance_to_pay_centavos: peso(1600), has_overdue: true });
  });

  it("judges overdue on the chosen date", () => {
    expect(row("2026-01-31", "Ana")?.has_overdue).toBe(false);
    expect(row("2026-02-15", "Ana")?.has_overdue).toBe(true);
  });

  it("counts a loan repaid later on the earlier date and drops it after it was repaid", () => {
    expect(row("2026-01-31", "Flo")).toMatchObject({ loans_centavos: peso(1000), balance_to_pay_centavos: peso(1050) });
    expect(row("2026-02-15", "Flo")).toMatchObject({ loans_centavos: 0, balance_to_pay_centavos: 0, savings_centavos: peso(3000) });
  });

  it("drops a loan withdrawn by the date, whose principal had already left the savings", () => {
    expect(row("2026-01-31", "Bo")).toMatchObject({ loans_centavos: peso(1000), savings_centavos: peso(4000) });
    expect(row("2026-02-15", "Bo")).toMatchObject({ loans_centavos: 0, balance_to_pay_centavos: 0, savings_centavos: peso(4000) });
  });

  it("never counts a voided row", () => {
    expect(row("2026-01-31", "Eve")?.savings_centavos).toBe(peso(500));
  });

  it("ranks like the Top participants view: ties share a rank by name, no savings last with no rank", () => {
    const more = { ...data, transactions: [...data.transactions, deposit("Eve", "2026-01-08", peso(7500)), deposit("Cy", "2026-02-22", peso(7990))] };
    const ranked = rankRows(standingsFor(more, "2026-03-15").map((item) => ({ participant_id: item.participant_id, name: item.name, driver_id: null, amount_centavos: item.savings_centavos })));
    expect(ranked.map((item) => [item.name, item.rank])).toEqual([["Ana", 1], ["Cy", 2], ["Eve", 2], ["Bo", 4], ["Flo", 5]]);
  });
});
