import { describe, expect, it } from "vitest";
import { buildDriverRows, staleBanner, staleRows, type ListDriver } from "@/lib/drivers/list-board";
import { defaultStaleSettings, type Absence } from "@/lib/drivers/absences";

const today = "2026-11-02";
const driver = (id: string, full_name: string, over: Partial<ListDriver> = {}): ListDriver =>
  ({ id, full_name, driver_kind: "primary", phone: "0917", license_number: `L-${id}`, license_expiry_date: "2030-12-31", is_active: true, ...over });
const absence = (driver_id: string, over: Partial<Absence>): Absence => ({
  id: `a-${driver_id}-${over.start_date}`, driver_id, absence_type: "on_leave", start_date: today, end_date: today, reason: "sick", note: null,
  cancelled_at: null, ended_early_on: null, snoozed_until: null, updated_at: "2026-11-01T00:00:00Z", ...over,
});
const build = (drivers: ListDriver[], absences: Absence[] = [], todayAssignments: { driver_id: string; unit_id: string; unitName: string }[] = []) =>
  buildDriverRows({ drivers, absences, todayAssignments, settings: defaultStaleSettings, today });

describe("buildDriverRows (feature 012, US3)", () => {
  // The five-driver mix from US3's independent test.
  const rows = build(
    [driver("d1", "Assigned"), driver("d2", "Free"), driver("d3", "Day-off"), driver("d4", "Open leave"), driver("d5", "Gone", { is_active: false })],
    [absence("d3", { absence_type: "day_off" }), absence("d4", { start_date: "2026-10-30", end_date: null })],
    [{ driver_id: "d1", unit_id: "u1", unitName: "ROLNET-1" }],
  );

  it("shows today's unit, Unassigned, or a dash (FR-005)", () => {
    expect(rows.map((row) => row.unitLabel)).toEqual(["ROLNET-1", "Unassigned", "—", "—", "—"]);
  });

  it("derives Status today and its second line (FR-006)", () => {
    expect(rows.map((row) => row.statusToday)).toEqual(["active", "active", "day_off", "on_leave", "inactive"]);
    expect(rows[3].statusLine).toEqual({ kind: "open", text: "open-ended" });
  });

  it("counts drivers available for assignment today (FR-008)", () => {
    expect(rows.filter((row) => row.availableToday).map((row) => row.id)).toEqual(["d2"]);
  });

  it("shows the leave's end date", () => {
    const [row] = build([driver("d1", "A")], [absence("d1", { start_date: "2026-11-01", end_date: "2026-11-09" })]);
    expect(row.statusLine).toEqual({ kind: "until", text: "until Nov 9" });
  });

  it("shows the soonest upcoming absence (FR-007)", () => {
    const [row] = build([driver("d1", "A")], [
      absence("d1", { start_date: "2026-11-05", end_date: "2026-11-09" }),
      absence("d1", { absence_type: "day_off", start_date: "2026-11-03", end_date: "2026-11-03" }),
    ]);
    expect(row.nextLine).toBe("Next: Day-off Nov 3");
  });
});

describe("stale leaves (feature 012, US6)", () => {
  const rows = build([driver("d1", "Amber"), driver("d2", "Red"), driver("d3", "Snoozed"), driver("d4", "Recent")], [
    absence("d1", { start_date: "2026-10-17", end_date: null }),
    absence("d2", { start_date: "2026-10-01", end_date: null }),
    absence("d3", { start_date: "2026-10-01", end_date: null, snoozed_until: "2026-11-05" }),
    absence("d4", { start_date: "2026-10-30", end_date: null }),
  ]);

  it("replaces open-ended with the stale warning, or shows checked while snoozed (FR-052, FR-055)", () => {
    expect(rows.map((row) => row.statusLine?.text)).toEqual(["Open for 16 days", "Open for 32 days", "open-ended · checked", "open-ended"]);
    expect(rows.map((row) => row.stale)).toEqual(["amber", "red", null, null]);
  });

  it("filters and counts only unsnoozed flagged leaves, red when any is red (FR-053)", () => {
    expect(staleRows(rows).map((row) => row.id)).toEqual(["d1", "d2"]);
    expect(staleBanner(rows, defaultStaleSettings)).toEqual({ count: 2, tone: "danger", text: "2 drivers have been on open-ended leave for 14 days or more." });
    expect(staleBanner([rows[0]], defaultStaleSettings)).toEqual({ count: 1, tone: "warning", text: "1 driver has been on open-ended leave for 14 days or more." });
    expect(staleBanner([rows[3]], defaultStaleSettings)).toBeNull();
  });
});
