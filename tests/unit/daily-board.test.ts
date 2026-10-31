import { describe, expect, it } from "vitest";
import { buildDailyBoard, type DailyRows } from "@/lib/remittances/daily-board";

const today = "2026-10-30";
const unit = (id: string, name: string, status = "active") => ({ id, name, body_number: `B-${id}`, status });
const primary = (id: string, unit_id: string, driverName: string, starts_on = "2026-10-01", ends_on: string | null = null) =>
  ({ id, unit_id, assignment_type: "primary", starts_on, ends_on, driver_id: `d-${id}`, covered_primary_assignment_id: null, driverName });
const backup = (id: string, unit_id: string, covers: string, driverName: string, date = today) =>
  ({ id, unit_id, assignment_type: "backup", starts_on: date, ends_on: date, driver_id: `d-${id}`, covered_primary_assignment_id: covers, driverName });
const dayOff = (primaryId: string, date = today) => ({ id: `o-${primaryId}`, primary_assignment_id: primaryId, day_off_date: date, notes: null });
const remittance = (unit_id: string, over: Partial<DailyRows["remittances"][number]> = {}): DailyRows["remittances"][number] => ({
  id: `r-${unit_id}`, unit_id, driver_id: "d-saved", assignment_id: "a-saved", disposition: "returned", amount_due_centavos: 18000, allowance_centavos: 4000, deposit_centavos: 14000, notes: null,
  updated_at: "2026-10-30T08:00:00Z", driverName: "Saved Driver", assignmentType: "primary", coveringFor: null, payments: [{ amount_centavos: 18000 }], ...over,
});
const rows = (over: Partial<DailyRows> = {}): DailyRows => ({ units: [], assignments: [], daysOff: [], remittances: [], drivers: [], ...over });
const build = (over: Partial<DailyRows>, date = today, isOwner = true) => buildDailyBoard({ date, today, rows: rows(over), isOwner });

describe("buildDailyBoard (feature 008)", () => {
  it("shows a saved record with the driver it was saved under, even if the schedule changed (FR-013)", () => {
    const board = build({ units: [unit("u1", "ROLNET-1")], assignments: [primary("p1", "u1", "New Driver")], remittances: [remittance("u1")] });
    expect(board.cards).toHaveLength(1);
    expect(board.cards[0]).toMatchObject({ kind: "saved", remittanceId: "r-u1", receivedCentavos: 18000, dueCentavos: 18000, driver: { name: "Saved Driver", role: "primary" } });
  });

  it("carries the saved allowance and deposit onto a saved card (feature 009)", () => {
    const board = build({ units: [unit("u1", "ROLNET-1")], assignments: [primary("p1", "u1", "Juan")], remittances: [remittance("u1", { payments: [{ amount_centavos: 10000 }], deposit_centavos: 6000 })] });
    expect(board.cards[0]).toMatchObject({ kind: "saved", receivedCentavos: 10000, allowanceCentavos: 4000, depositCentavos: 6000 });
  });

  it("shows the scheduled primary on an unrecorded card", () => {
    const board = build({ units: [unit("u1", "ROLNET-1")], assignments: [primary("p1", "u1", "Juan")] });
    expect(board.cards[0]).toMatchObject({ kind: "unrecorded", assignmentId: "p1", driver: { name: "Juan", role: "primary", coveringFor: null } });
  });

  it("shows the backup covering a day off, with the primary's name (FR-011, FR-012)", () => {
    const board = build({ units: [unit("u1", "ROLNET-1")], assignments: [primary("p1", "u1", "Juan"), backup("b1", "u1", "p1", "Pedro")], daysOff: [dayOff("p1")] });
    expect(board.cards[0]).toMatchObject({ kind: "unrecorded", assignmentId: "b1", driver: { name: "Pedro", role: "backup", coveringFor: "Juan" } });
  });

  it("marks a day off with no backup as not operating (FR-014)", () => {
    const board = build({ units: [unit("u1", "ROLNET-1")], assignments: [primary("p1", "u1", "Juan")], daysOff: [dayOff("p1")] });
    expect(board.cards[0]).toMatchObject({ kind: "no-driver", dayOffId: "o-p1", primaryDriverName: "Juan" });
    expect(board.countable).toBe(0);
  });

  it("marks a unit in repair as not operating today only (FR-014a)", () => {
    const over = { units: [unit("u1", "ROLNET-1", "in_repair")], assignments: [primary("p1", "u1", "Juan")] };
    expect(build(over).cards[0].kind).toBe("in-repair");
    expect(build(over, "2026-10-20").cards[0].kind).toBe("unrecorded");
  });

  it("keeps a saved record on a unit that is in repair today, and counts it", () => {
    const board = build({ units: [unit("u1", "ROLNET-1", "in_repair")], assignments: [primary("p1", "u1", "Juan")], remittances: [remittance("u1")] });
    expect(board.cards[0].kind).toBe("saved");
    expect(board).toMatchObject({ recorded: 1, countable: 1 });
  });

  it("gives no card to a unit whose primary starts after the date (FR-010)", () => {
    expect(build({ units: [unit("u1", "ROLNET-1")], assignments: [primary("p1", "u1", "Juan", "2026-10-29")] }, "2026-10-20").cards).toHaveLength(0);
  });

  it("gives no card today to a retired unit, unless it has a saved record today", () => {
    const over = { units: [unit("u1", "ROLNET-1", "retired")], assignments: [primary("p1", "u1", "Juan")] };
    expect(build(over).cards).toHaveLength(0);
    expect(build({ ...over, remittances: [remittance("u1")] }).cards).toHaveLength(1);
  });

  it("counts recorded and countable cards, leaving out not-operating ones (FR-008)", () => {
    const board = build({
      units: [unit("u1", "ROLNET-1"), unit("u2", "ROLNET-2"), unit("u3", "ROLNET-3", "in_repair"), unit("u4", "ROLNET-4")],
      assignments: [primary("p1", "u1", "A"), primary("p2", "u2", "B"), primary("p3", "u3", "C"), primary("p4", "u4", "D")],
      daysOff: [dayOff("p4")],
      remittances: [remittance("u1", { payments: [{ amount_centavos: 10000 }, { amount_centavos: 5000 }] })],
    });
    expect(board).toMatchObject({ recorded: 1, countable: 2, receivedCentavos: 15000 });
  });

  it("reports zero of zero when every card is not operating", () => {
    const board = build({ units: [unit("u1", "ROLNET-1", "in_repair")], assignments: [primary("p1", "u1", "A")] });
    expect(board).toMatchObject({ recorded: 0, countable: 0 });
    expect(board.cards).toHaveLength(1);
  });

  it("has no cards on an empty date (FR-032)", () => {
    expect(build({ units: [unit("u1", "ROLNET-1")] }).cards).toEqual([]);
  });

  it("sorts cards by unit name, numbers in order", () => {
    const board = build({ units: [unit("u10", "ROLNET-10"), unit("u2", "ROLNET-2")], assignments: [primary("p10", "u10", "A"), primary("p2", "u2", "B")] });
    expect(board.cards.map((card) => card.unitName)).toEqual(["ROLNET-2", "ROLNET-10"]);
  });

  it("keys cards by date and unit", () => {
    expect(build({ units: [unit("u1", "ROLNET-1")], assignments: [primary("p1", "u1", "A")] }).cards[0].key).toBe(`${today}:u1`);
  });

  it("lists only drivers free to cover the date, for owners (FR-014b)", () => {
    const over = {
      units: [unit("u1", "ROLNET-1")],
      assignments: [primary("p1", "u1", "Juan")],
      daysOff: [dayOff("p1")],
      drivers: [
        { id: "d-p1", full_name: "Juan", is_active: true, license_expiry_date: "2027-01-01" },
        { id: "free", full_name: "Free", is_active: true, license_expiry_date: "2027-01-01" },
        { id: "inactive", full_name: "Inactive", is_active: false, license_expiry_date: "2027-01-01" },
        { id: "expired", full_name: "Expired", is_active: true, license_expiry_date: "2026-10-29" },
      ],
    };
    expect(build(over).freeDrivers).toEqual([{ id: "free", name: "Free" }]);
    expect(build(over, today, false).freeDrivers).toEqual([]);
  });
});
