import { describe, expect, it } from "vitest";
import { currentDrivers, type UnitAssignmentRow } from "@/lib/assignments/current-drivers";
import type { DayOffRow } from "@/lib/assignments/coverage";

const today = "2026-10-10";
const primary = (id: string, unit_id: string, driverName: string, starts_on = "2026-10-01", ends_on: string | null = null): UnitAssignmentRow =>
  ({ id, unit_id, assignment_type: "primary", starts_on, ends_on, driver_id: `d-${id}`, covered_primary_assignment_id: null, driverName });
const dayOff = (primaryId: string): DayOffRow => ({ id: `o-${primaryId}`, primary_assignment_id: primaryId, day_off_date: today, notes: null });

describe("currentDrivers (feature 007, FR-007)", () => {
  it("shows the primary driver on a normal day", () => {
    expect(currentDrivers(["u1"], [primary("p1", "u1", "Juan")], [], today).get("u1")).toEqual({ kind: "primary", driverName: "Juan", driverId: "d-p1" });
  });

  it("shows the backup covering the primary's day off", () => {
    const backup: UnitAssignmentRow = { id: "b1", unit_id: "u1", assignment_type: "backup", starts_on: today, ends_on: today, driver_id: "d-b1", covered_primary_assignment_id: "p1", driverName: "Pedro" };
    expect(currentDrivers(["u1"], [primary("p1", "u1", "Juan"), backup], [dayOff("p1")], today).get("u1")).toEqual({ kind: "backup", driverName: "Pedro", driverId: "d-b1" });
  });

  it("flags a day off with no backup", () => {
    expect(currentDrivers(["u1"], [primary("p1", "u1", "Juan")], [dayOff("p1")], today).get("u1")).toEqual({ kind: "day-off" });
  });

  it("shows unassigned with no primary, an ended primary, or one that starts later", () => {
    const result = currentDrivers(["u1", "u2", "u3"], [primary("p2", "u2", "Ana", "2026-09-01", "2026-10-09"), primary("p3", "u3", "Liza", "2026-10-11")], [], today);
    expect(result.get("u1")).toEqual({ kind: "unassigned" });
    expect(result.get("u2")).toEqual({ kind: "unassigned" });
    expect(result.get("u3")).toEqual({ kind: "unassigned" });
  });

  it("keeps each unit's assignments and days off apart", () => {
    const result = currentDrivers(["u1", "u2"], [primary("p1", "u1", "Juan"), primary("p2", "u2", "Ana")], [dayOff("p1")], today);
    expect(result.get("u1")).toEqual({ kind: "day-off" });
    expect(result.get("u2")).toEqual({ kind: "primary", driverName: "Ana", driverId: "d-p2" });
  });
});
