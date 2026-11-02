import { describe, expect, it } from "vitest";
import { buildAssignmentBoard, type AssignmentRows } from "@/lib/units/assignment-board";

const today = "2026-11-01";
const unit = (id: string, name: string, created_at = "2026-01-01T00:00:00Z") => ({ id, name, body_number: `B-${id}`, plate_number: `P-${id}`, make_model: "Honda TMX", created_at });
const driver = (id: string, full_name: string, driver_kind: "primary" | "backup" = "primary", is_active = true, license_expiry_date = "2030-12-31") => ({ id, full_name, driver_kind, is_active, license_expiry_date });
const saved = (unit_id: string, driver_id: string, driverName: string, driverKind: "primary" | "backup" = "primary") =>
  ({ id: `a-${unit_id}`, unit_id, driver_id, notes: null, updated_at: "2026-11-01T07:00:00Z", driverName, driverKind });
const rows = (over: Partial<AssignmentRows> = {}): AssignmentRows => ({ units: [], statusChanges: [], assignments: [], remittanceUnitIds: [], drivers: [], prefill: [], ...over });
const build = (over: Partial<AssignmentRows>, date = today) => buildAssignmentBoard({ date, today, rows: rows(over) });
const optionIds = (card: { options: { id: string }[] }) => card.options.map((option) => option.id);

const drivers = [driver("d1", "Ana"), driver("d2", "Ben", "backup"), driver("d3", "Cora")];

describe("buildAssignmentBoard (feature 010, US1)", () => {
  it("shows one card per unit, sorted by name, with the subheader", () => {
    const board = build({ units: [unit("u10", "ROLNET-10"), unit("u2", "ROLNET-2")] });
    expect(board.cards.map((card) => card.unitName)).toEqual(["ROLNET-2", "ROLNET-10"]);
    expect(board.cards[0].subheader).toBe("B-u2 · P-u2 · Honda TMX");
    expect(board.isToday).toBe(true);
    expect(board.isFuture).toBe(false);
  });

  it("leaves out units on dates before they were added (FR-011a)", () => {
    const board = build({ units: [unit("u1", "A"), unit("u2", "B", "2026-11-02T00:00:00Z")] });
    expect(board.cards.map((card) => card.unitId)).toEqual(["u1"]);
  });

  it("locks a saved card and carries its assignment (FR-019)", () => {
    const board = build({ units: [unit("u1", "A")], drivers, assignments: [saved("u1", "d2", "Ben", "backup")] });
    expect(board.cards[0]).toMatchObject({ kind: "saved", assignmentId: "a-u1", driverId: "d2", driverLabel: "Ben (Backup)", notes: "", updatedAt: "2026-11-01T07:00:00Z" });
  });

  it("locks the card for good when the day has a remittance (FR-019a)", () => {
    const board = build({ units: [unit("u1", "A")], drivers, assignments: [saved("u1", "d1", "Ana")], remittanceUnitIds: ["u1"] });
    expect(board.cards[0].kind).toBe("locked");
  });

  it("lists only drivers not saved on another unit, keeping the card's own driver (FR-014)", () => {
    const board = build({ units: [unit("u1", "A"), unit("u2", "B")], drivers, assignments: [saved("u1", "d1", "Ana")] });
    expect(optionIds(board.cards[0])).toEqual(["d1", "d2", "d3"]);
    expect(optionIds(board.cards[1])).toEqual(["d2", "d3"]);
  });

  it("leaves out inactive drivers and drivers whose licence has expired by the date", () => {
    const board = build({ units: [unit("u1", "A")], drivers: [...drivers, driver("d4", "Dino", "primary", false), driver("d5", "Eve", "primary", true, "2026-10-31")] });
    expect(optionIds(board.cards[0])).toEqual(["d1", "d2", "d3"]);
  });

  it("labels options with the driver's role (FR-015)", () => {
    const board = build({ units: [unit("u1", "A")], drivers });
    expect(board.cards[0].options.map((option) => option.label)).toEqual(["Ana (Primary)", "Ben (Backup)", "Cora (Primary)"]);
  });

  it("counts saved and locked cards as assigned", () => {
    const board = build({ units: [unit("u1", "A"), unit("u2", "B"), unit("u3", "C")], drivers, assignments: [saved("u1", "d1", "Ana"), saved("u2", "d2", "Ben")], remittanceUnitIds: ["u2"] });
    expect(board.assigned).toBe(2);
    expect(board.assignable).toBe(3);
  });
});

describe("pre-fill (feature 010, US2)", () => {
  const tomorrow = "2026-11-02";
  const units = [unit("u1", "A"), unit("u2", "B")];

  it("pre-fills open cards on a future date with the latest earlier driver (FR-021)", () => {
    const board = build({ units, drivers, prefill: [{ unit_id: "u1", driver_id: "d1" }] }, tomorrow);
    expect(board.cards[0]).toMatchObject({ kind: "open", prefillDriverId: "d1" });
    expect(board.cards[1]).toMatchObject({ kind: "open", prefillDriverId: null });
  });

  it("doesn't pre-fill today or past dates", () => {
    expect(build({ units, drivers, prefill: [{ unit_id: "u1", driver_id: "d1" }] }).cards[0]).toMatchObject({ prefillDriverId: null });
    expect(build({ units, drivers, prefill: [{ unit_id: "u1", driver_id: "d1" }] }, "2026-10-31").cards[0]).toMatchObject({ prefillDriverId: null });
  });

  it("leaves the card empty when the driver is saved on another unit that date", () => {
    const board = build({ units, drivers, assignments: [saved("u2", "d1", "Ana")], prefill: [{ unit_id: "u1", driver_id: "d1" }] }, tomorrow);
    expect(board.cards[0]).toMatchObject({ kind: "open", prefillDriverId: null });
  });

  it("leaves the card empty when the driver is no longer eligible", () => {
    const board = build({ units, drivers: [driver("d1", "Ana", "primary", false)], prefill: [{ unit_id: "u1", driver_id: "d1" }] }, tomorrow);
    expect(board.cards[0]).toMatchObject({ prefillDriverId: null });
  });

  it("gives saved and blocked cards no pre-fill, and pre-fills never count as assigned", () => {
    const board = build({
      units: [...units, unit("u3", "C")], drivers,
      assignments: [saved("u2", "d2", "Ben")],
      statusChanges: [{ unit_id: "u3", from_status: "active", to_status: "in_repair", effective_on: "2026-10-30", changed_at: "2026-10-30T09:00:00Z" }],
      prefill: [{ unit_id: "u1", driver_id: "d1" }, { unit_id: "u2", driver_id: "d3" }, { unit_id: "u3", driver_id: "d3" }],
    }, tomorrow);
    expect(board.cards.map((card) => card.kind)).toEqual(["open", "saved", "blocked"]);
    expect(board.assigned).toBe(1);
  });

  it("lets two cards suggest the same driver while neither is saved", () => {
    const board = build({ units, drivers, prefill: [{ unit_id: "u1", driver_id: "d1" }, { unit_id: "u2", driver_id: "d1" }] }, tomorrow);
    expect(board.cards.map((card) => card.kind === "open" && card.prefillDriverId)).toEqual(["d1", "d1"]);
  });
});

describe("blocked cards (feature 010, US4)", () => {
  const changes = [
    { unit_id: "u1", from_status: "active" as const, to_status: "in_repair" as const, effective_on: "2026-11-01", changed_at: "2026-11-01T01:00:00Z" },
    { unit_id: "u1", from_status: "in_repair" as const, to_status: "active" as const, effective_on: "2026-11-05", changed_at: "2026-11-05T01:00:00Z" },
  ];

  it("blocks a unit from the day its status changed until it returns to Active (FR-026, FR-028)", () => {
    const at = (date: string) => buildAssignmentBoard({ date, today: date, rows: rows({ units: [unit("u1", "A")], drivers, statusChanges: changes }) }).cards[0];
    expect(at("2026-10-31").kind).toBe("open");
    expect(at("2026-11-01")).toMatchObject({ kind: "blocked", status: "in_repair", options: [] });
    expect(at("2026-11-04").kind).toBe("blocked");
    expect(at("2026-11-05").kind).toBe("open");
  });

  it("leaves blocked cards out of the count", () => {
    const board = build({ units: [unit("u1", "A"), unit("u2", "B")], drivers, statusChanges: changes });
    expect(board.assignable).toBe(1);
    expect(board.assigned).toBe(0);
  });

  it("still shows a saved assignment on a blocked date as saved (FR-027)", () => {
    const board = build({ units: [unit("u1", "A")], drivers, statusChanges: changes, assignments: [saved("u1", "d1", "Ana")], remittanceUnitIds: ["u1"] });
    expect(board.cards[0].kind).toBe("locked");
    expect(board.assignable).toBe(1);
  });

  it("labels Retired units", () => {
    const board = build({ units: [unit("u1", "A")], statusChanges: [{ unit_id: "u1", from_status: "active", to_status: "retired", effective_on: "2026-10-01", changed_at: "2026-10-01T01:00:00Z" }] });
    expect(board.cards[0]).toMatchObject({ kind: "blocked", status: "retired" });
  });
});

describe("absences (feature 012, FR-040, FR-041)", () => {
  const units = [unit("u1", "A"), unit("u2", "B")];
  const leave = (driver_id: string, start_date: string, end_date: string | null) => ({ driver_id, start_date, end_date, cancelled_at: null, ended_early_on: null });

  it("leaves a driver out of every dropdown on dates his absence covers", () => {
    const board = build({ units, drivers, absences: [leave("d1", today, today)] });
    expect(board.cards.every((card) => !optionIds(card).includes("d1"))).toBe(true);
    expect(optionIds(build({ units, drivers, absences: [leave("d1", today, today)] }, "2026-11-02").cards[0])).toContain("d1");
  });

  it("doesn't pre-fill the previous day's driver when he is absent on the date", () => {
    const board = build({ units, drivers, prefill: [{ unit_id: "u1", driver_id: "d1" }], absences: [leave("d1", "2026-11-02", null)] }, "2026-11-02");
    expect(board.cards[0]).toMatchObject({ kind: "open", prefillDriverId: null });
  });

  it("ignores cancelled absences", () => {
    const board = build({ units, drivers, absences: [{ ...leave("d1", today, today), cancelled_at: "2026-10-31T00:00:00Z" }] });
    expect(optionIds(board.cards[0])).toContain("d1");
  });
});
