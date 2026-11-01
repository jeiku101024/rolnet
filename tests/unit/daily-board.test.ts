import { describe, expect, it } from "vitest";
import { buildDailyBoard, type DailyRows } from "@/lib/remittances/daily-board";

const today = "2026-11-01";
const unit = (id: string, name: string, over: Partial<DailyRows["units"][number]> = {}) => ({ id, name, body_number: `B-${id}`, created_at: "2026-01-01T00:00:00Z", archived: false, ...over });
const assigned = (unit_id: string, driverName: string, driverRole: "primary" | "backup" = "primary") => ({ unit_id, driver_id: `d-${unit_id}`, driverName, driverRole });
const repair = (unit_id: string, effective_on = today, to_status: "in_repair" | "retired" = "in_repair") => ({ unit_id, from_status: "active" as const, to_status, effective_on, changed_at: `${effective_on}T01:00:00Z` });
const remittance = (unit_id: string, over: Partial<DailyRows["remittances"][number]> = {}): DailyRows["remittances"][number] => ({
  id: `r-${unit_id}`, unit_id, driver_id: "d-saved", disposition: "returned", amount_due_centavos: 18000, allowance_centavos: 4000, deposit_centavos: 14000, notes: null,
  updated_at: "2026-11-01T08:00:00Z", driverName: "Saved Driver", driverRole: "primary", payments: [{ amount_centavos: 18000 }], ...over,
});
const rows = (over: Partial<DailyRows> = {}): DailyRows => ({ units: [], statusChanges: [], assignments: [], remittances: [], ...over });
const build = (over: Partial<DailyRows>, date = today) => buildDailyBoard({ date, today, rows: rows(over) });

describe("buildDailyBoard (feature 008, updated by feature 010)", () => {
  it("shows a saved record with the driver it was saved under, even if the assignment changed (FR-045)", () => {
    const board = build({ units: [unit("u1", "ROLNET-1")], assignments: [assigned("u1", "New Driver")], remittances: [remittance("u1")] });
    expect(board.cards).toHaveLength(1);
    expect(board.cards[0]).toMatchObject({ kind: "saved", remittanceId: "r-u1", receivedCentavos: 18000, dueCentavos: 18000, driver: { name: "Saved Driver", role: "primary" } });
  });

  it("carries the saved allowance and deposit onto a saved card (feature 009)", () => {
    const board = build({ units: [unit("u1", "ROLNET-1")], remittances: [remittance("u1", { payments: [{ amount_centavos: 10000 }], deposit_centavos: 6000 })] });
    expect(board.cards[0]).toMatchObject({ kind: "saved", receivedCentavos: 10000, allowanceCentavos: 4000, depositCentavos: 6000 });
  });

  it("takes an unrecorded card's driver and role from the day's assignment (FR-043)", () => {
    const board = build({ units: [unit("u1", "ROLNET-1"), unit("u2", "ROLNET-2")], assignments: [assigned("u1", "Juan"), assigned("u2", "Pedro", "backup")] });
    expect(board.cards[0]).toMatchObject({ kind: "unrecorded", driver: { driverId: "d-u1", name: "Juan", role: "primary" } });
    expect(board.cards[1]).toMatchObject({ kind: "unrecorded", driver: { name: "Pedro", role: "backup" } });
    expect(board.cards[1]).not.toHaveProperty("driver.coveringFor");
  });

  it("asks for a driver when the unit has no assignment, and counts it (FR-044)", () => {
    const board = build({ units: [unit("u1", "ROLNET-1")] });
    expect(board.cards[0]).toMatchObject({ kind: "no-driver" });
    expect(board).toMatchObject({ recorded: 0, countable: 1 });
  });

  it("blocks a unit in repair or retired on the date, and leaves it out of the count (FR-046)", () => {
    const board = build({ units: [unit("u1", "ROLNET-1"), unit("u2", "ROLNET-2")], statusChanges: [repair("u1"), repair("u2", "2026-10-01", "retired")], assignments: [assigned("u1", "Juan")] });
    expect(board.cards.map((card) => card.kind === "blocked" && card.status)).toEqual(["in_repair", "retired"]);
    expect(board).toMatchObject({ recorded: 0, countable: 0, receivedCentavos: 0 });
  });

  it("doesn't block dates before the status change (FR-024)", () => {
    expect(build({ units: [unit("u1", "ROLNET-1")], statusChanges: [repair("u1")], assignments: [assigned("u1", "Juan")] }, "2026-10-31").cards[0].kind).toBe("unrecorded");
  });

  it("keeps a saved record on a blocked date, and counts it (FR-047)", () => {
    const board = build({ units: [unit("u1", "ROLNET-1")], statusChanges: [repair("u1")], remittances: [remittance("u1")] });
    expect(board.cards[0].kind).toBe("saved");
    expect(board).toMatchObject({ recorded: 1, countable: 1, receivedCentavos: 18000 });
  });

  it("hides archived units on every date, even with a saved record (FR-048)", () => {
    expect(build({ units: [unit("u1", "ROLNET-1", { archived: true })], remittances: [remittance("u1")] }).cards).toEqual([]);
  });

  it("leaves out units added after the date unless they have a saved record (FR-011a)", () => {
    const later = unit("u1", "ROLNET-1", { created_at: "2026-11-05T00:00:00Z" });
    expect(build({ units: [later] }).cards).toEqual([]);
    expect(build({ units: [later], remittances: [remittance("u1")] }).cards).toHaveLength(1);
  });

  it("counts recorded and countable cards and totals what was received", () => {
    const board = build({
      units: [unit("u1", "ROLNET-1"), unit("u2", "ROLNET-2"), unit("u3", "ROLNET-3"), unit("u4", "ROLNET-4")],
      statusChanges: [repair("u3")],
      assignments: [assigned("u1", "A"), assigned("u2", "B")],
      remittances: [remittance("u1", { payments: [{ amount_centavos: 10000 }, { amount_centavos: 5000 }] })],
    });
    expect(board).toMatchObject({ recorded: 1, countable: 3, receivedCentavos: 15000 });
  });

  it("has no cards when there are no units", () => {
    expect(build({}).cards).toEqual([]);
  });

  it("sorts cards by unit name, numbers in order, and keys them by date and unit", () => {
    const board = build({ units: [unit("u10", "ROLNET-10"), unit("u2", "ROLNET-2")] });
    expect(board.cards.map((card) => card.unitName)).toEqual(["ROLNET-2", "ROLNET-10"]);
    expect(board.cards[0].key).toBe(`${today}:u2`);
  });
});
