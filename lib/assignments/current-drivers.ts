import { coverageOn, type AssignmentRow, type DayOffRow } from "@/lib/assignments/coverage";

// Feature 007 (FR-007): who operates each unit today, for the units register's Current driver
// column. The rules are the unit page's "Operating driver" ones, from coverageOn.

export type UnitAssignmentRow = AssignmentRow & { unit_id: string };
export type CurrentDriver =
  | { kind: "primary"; driverName: string; driverId: string }
  | { kind: "backup"; driverName: string; driverId: string }
  | { kind: "day-off" }
  | { kind: "unassigned" };

export function currentDrivers(unitIds: string[], assignments: UnitAssignmentRow[], daysOff: DayOffRow[], today: string) {
  const result = new Map<string, CurrentDriver>();
  for (const unitId of unitIds) {
    const { backup, dayOff, operator } = coverageOn(today, assignments.filter((a) => a.unit_id === unitId), daysOff);
    if (operator) result.set(unitId, { kind: backup ? "backup" : "primary", driverName: operator.driverName, driverId: operator.driver_id });
    else result.set(unitId, dayOff ? { kind: "day-off" } : { kind: "unassigned" });
  }
  return result;
}
