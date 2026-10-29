import { describe, expect, it } from "vitest";
import { backupFor, coverageOn, type AssignmentRow, type DayOffRow } from "@/lib/assignments/coverage";

const primary: AssignmentRow = { id: "p1", assignment_type: "primary", starts_on: "2026-10-01", ends_on: "2026-10-31", driver_id: "d1", covered_primary_assignment_id: null, driverName: "Primary" };
const backup: AssignmentRow = { id: "b1", assignment_type: "backup", starts_on: "2026-10-10", ends_on: "2026-10-10", driver_id: "d2", covered_primary_assignment_id: "p1", driverName: "Backup" };
const dayOff: DayOffRow = { id: "o1", primary_assignment_id: "p1", day_off_date: "2026-10-10", notes: null };
const uncovered: DayOffRow = { id: "o2", primary_assignment_id: "p1", day_off_date: "2026-10-12", notes: null };

describe("coverageOn (T136)", () => {
  it("returns the primary driver on a normal day", () => {
    expect(coverageOn("2026-10-05", [primary, backup], [dayOff]).operator?.id).toBe("p1");
  });
  it("returns the backup on the primary's day off", () => {
    const result = coverageOn("2026-10-10", [primary, backup], [dayOff]);
    expect(result.dayOff?.id).toBe("o1");
    expect(result.operator?.id).toBe("b1");
  });
  it("returns no operator on an uncovered day off, and nobody after the assignment ends", () => {
    expect(coverageOn("2026-10-12", [primary, backup], [dayOff, uncovered]).operator).toBeNull();
    expect(coverageOn("2026-11-01", [primary], []).primary).toBeNull();
  });
  it("finds the backup covering a day off", () => {
    expect(backupFor(dayOff, [primary, backup])?.id).toBe("b1");
    expect(backupFor(uncovered, [primary, backup])).toBeNull();
  });
});
