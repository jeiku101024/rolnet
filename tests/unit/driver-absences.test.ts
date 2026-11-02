import { describe, expect, it } from "vitest";
import {
  absenceStatus, absenceToast, covers, coveringAbsence, daysOpen, defaultStaleSettings, formatAbsenceDates, lastCoveredDate,
  nextAbsenceLine, staleLevel, statusToday, upcomingAbsences, type Absence,
} from "@/lib/drivers/absences";

const today = "2026-11-02";
const absence = (over: Partial<Absence>): Absence => ({
  id: "a1", driver_id: "d1", absence_type: "on_leave", start_date: "2026-11-05", end_date: "2026-11-09", reason: "sick", note: null,
  cancelled_at: null, ended_early_on: null, snoozed_until: null, updated_at: "2026-11-01T00:00:00Z", ...over,
});

describe("covers (feature 012, research R3)", () => {
  it("includes both the first and the last day", () => {
    const leave = absence({});
    expect(covers(leave, "2026-11-04")).toBe(false);
    expect(covers(leave, "2026-11-05")).toBe(true);
    expect(covers(leave, "2026-11-09")).toBe(true);
    expect(covers(leave, "2026-11-10")).toBe(false);
  });
  it("covers every date from the start of an open-ended leave", () => {
    expect(covers(absence({ end_date: null }), "2027-06-01")).toBe(true);
  });
  it("stops the day an absence was ended early", () => {
    const ended = absence({ ended_early_on: "2026-11-07" });
    expect(covers(ended, "2026-11-06")).toBe(true);
    expect(covers(ended, "2026-11-07")).toBe(false);
    expect(lastCoveredDate(ended)).toBe("2026-11-06");
  });
  it("covers nothing when ended early on its start day or cancelled", () => {
    expect(covers(absence({ ended_early_on: "2026-11-05" }), "2026-11-05")).toBe(false);
    expect(covers(absence({ cancelled_at: "2026-11-01T00:00:00Z" }), "2026-11-06")).toBe(false);
  });
  it("reports the last covered date", () => {
    expect(lastCoveredDate(absence({}))).toBe("2026-11-09");
    expect(lastCoveredDate(absence({ end_date: null }))).toBeNull();
  });
});

describe("statusToday (FR-032)", () => {
  it("gives Inactive precedence over a covering absence", () => {
    expect(statusToday(false, [absence({ start_date: today })], today)).toBe("inactive");
  });
  it("is Day-off or On-leave when an absence covers today, else Active", () => {
    expect(statusToday(true, [absence({ absence_type: "day_off", start_date: today, end_date: today })], today)).toBe("day_off");
    expect(statusToday(true, [absence({ start_date: "2026-10-30" })], today)).toBe("on_leave");
    expect(statusToday(true, [absence({})], today)).toBe("active");
  });
  it("returns to Active by itself once the absence has passed", () => {
    expect(statusToday(true, [absence({ start_date: "2026-10-28", end_date: "2026-11-01" })], today)).toBe("active");
  });
});

describe("absenceStatus (FR-047)", () => {
  it("orders cancelled, ended early, upcoming, active now, completed", () => {
    expect(absenceStatus(absence({ cancelled_at: "x" }), today)).toBe("cancelled");
    expect(absenceStatus(absence({ start_date: "2026-11-01", ended_early_on: today }), today)).toBe("ended_early");
    expect(absenceStatus(absence({}), today)).toBe("upcoming");
    expect(absenceStatus(absence({ start_date: "2026-11-01" }), today)).toBe("active");
    expect(absenceStatus(absence({ start_date: "2026-10-20", end_date: "2026-10-25" }), today)).toBe("completed");
  });
});

describe("coveringAbsence and upcomingAbsences", () => {
  const list = [absence({ id: "late", start_date: "2026-11-20", end_date: "2026-11-21" }), absence({ id: "soon" }), absence({ id: "now", start_date: "2026-11-01", end_date: "2026-11-03" }), absence({ id: "gone", start_date: "2026-11-10", end_date: "2026-11-10", cancelled_at: "x" })];
  it("finds the absence covering a date", () => {
    expect(coveringAbsence(list, today)?.id).toBe("now");
  });
  it("lists upcoming absences soonest first, without cancelled ones", () => {
    expect(upcomingAbsences(list, today).map((a) => a.id)).toEqual(["soon", "late"]);
  });
});

describe("staleLevel (FR-051, FR-055)", () => {
  const open = (startDaysAgo: number, over: Partial<Absence> = {}) => {
    const start = new Date(Date.parse(`${today}T00:00:00Z`) - startDaysAgo * 86_400_000).toISOString().slice(0, 10);
    return absence({ start_date: start, end_date: null, ...over });
  };
  it("counts days open from the start date", () => {
    expect(daysOpen(open(16), today)).toBe(16);
  });
  it("flags amber from 14 days and red from 30 days", () => {
    expect(staleLevel(open(13), today, defaultStaleSettings)).toBe("none");
    expect(staleLevel(open(14), today, defaultStaleSettings)).toBe("amber");
    expect(staleLevel(open(29), today, defaultStaleSettings)).toBe("amber");
    expect(staleLevel(open(30), today, defaultStaleSettings)).toBe("red");
  });
  it("uses the thresholds from settings", () => {
    expect(staleLevel(open(10), today, { amber: 7, red: 10, snooze: 3 })).toBe("red");
  });
  it("hides the flag while snoozed and brings it back on the snooze date", () => {
    expect(staleLevel(open(20, { snoozed_until: "2026-11-03" }), today, defaultStaleSettings)).toBe("snoozed");
    expect(staleLevel(open(20, { snoozed_until: today }), today, defaultStaleSettings)).toBe("amber");
  });
  it("never flags a leave with an end date, a day-off, or a leave that isn't current", () => {
    expect(staleLevel(open(40, { end_date: "2026-12-31" }), today, defaultStaleSettings)).toBe("none");
    expect(staleLevel(open(40, { absence_type: "day_off" }), today, defaultStaleSettings)).toBe("none");
    expect(staleLevel(open(40, { ended_early_on: today }), today, defaultStaleSettings)).toBe("none");
  });
});

describe("copy", () => {
  it("formats absence dates", () => {
    expect(formatAbsenceDates(absence({ absence_type: "day_off", end_date: "2026-11-05" }))).toBe("Nov 5");
    expect(formatAbsenceDates(absence({}))).toBe("Nov 5 to Nov 9");
    expect(formatAbsenceDates(absence({ start_date: "2026-11-01", end_date: null }))).toBe("from Nov 1 (open-ended)");
  });
  it("formats the list's next-absence line", () => {
    expect(nextAbsenceLine(absence({ absence_type: "day_off", start_date: "2026-11-03", end_date: "2026-11-03" }))).toBe("Next: Day-off Nov 3");
    expect(nextAbsenceLine(absence({}))).toBe("Next: On-leave Nov 5–Nov 9");
    expect(nextAbsenceLine(absence({ end_date: null }))).toBe("Next: On-leave from Nov 5");
  });
  it("builds the save toasts", () => {
    expect(absenceToast("RA SHAA", absence({ absence_type: "day_off", end_date: "2026-11-05" }))).toBe("RA SHAA is on day-off Nov 5");
    expect(absenceToast("RA SHAA", absence({ start_date: "2026-11-03", end_date: "2026-11-10" }))).toBe("RA SHAA is on leave Nov 3 to Nov 10");
    expect(absenceToast("RA SHAA", absence({ start_date: "2026-11-03", end_date: null }))).toBe("RA SHAA is on leave from Nov 3 (no end date)");
  });
});
