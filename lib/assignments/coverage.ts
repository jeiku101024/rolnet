// Works out who operates a unit on a calendar date from its assignments and days off (FR-011,
// FR-012): the primary driver whose range covers the date, unless that driver has a day off,
// in which case the backup covering that day (if any).

export type AssignmentRow = { id: string; assignment_type: string; starts_on: string; ends_on: string | null; driver_id: string; covered_primary_assignment_id: string | null; driverName: string };
export type DayOffRow = { id: string; primary_assignment_id: string; day_off_date: string; notes: string | null };

export function covers(assignment: { starts_on: string; ends_on: string | null }, date: string) {
  return assignment.starts_on <= date && (!assignment.ends_on || assignment.ends_on >= date);
}

export function coverageOn(date: string, assignments: AssignmentRow[], daysOff: DayOffRow[]) {
  const primary = assignments.find((a) => a.assignment_type === "primary" && covers(a, date)) ?? null;
  const dayOff = primary ? daysOff.find((d) => d.primary_assignment_id === primary.id && d.day_off_date === date) ?? null : null;
  const backup = dayOff ? assignments.find((a) => a.assignment_type === "backup" && a.covered_primary_assignment_id === primary?.id && a.starts_on === date) ?? null : null;
  const operator = dayOff ? backup : primary;
  return { primary, dayOff, backup, operator };
}

/** The backup assignment that covers a given day off, if any. */
export function backupFor(dayOff: DayOffRow, assignments: AssignmentRow[]) {
  return assignments.find((a) => a.assignment_type === "backup" && a.covered_primary_assignment_id === dayOff.primary_assignment_id && a.starts_on === dayOff.day_off_date) ?? null;
}
