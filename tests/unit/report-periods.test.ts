import { describe, expect, it } from "vitest";
import { days, defaultPeriods, weekCoverText, monthRange, monthWeeks, validatePeriod, weekOfMonth, weekRange, weeklyLabel, yearRange } from "@/lib/reports/periods";

describe("report periods (feature 009, research R6)", () => {
  it("finds Monday to Sunday of a week, across months and years", () => {
    expect(weekRange("2025-01-29")).toEqual({ from: "2025-01-27", to: "2025-02-02" });
    expect(weekRange("2025-01-27")).toEqual({ from: "2025-01-27", to: "2025-02-02" });
    expect(weekRange("2025-02-02")).toEqual({ from: "2025-01-27", to: "2025-02-02" });
    expect(weekRange("2025-01-01")).toEqual({ from: "2024-12-30", to: "2025-01-05" });
  });

  it("numbers weeks of the month from the 1st to the first Sunday", () => {
    for (const day of ["01", "02", "03", "04", "05"]) expect(weekOfMonth(`2025-01-${day}`)).toBe(1);
    expect(weekOfMonth("2025-01-06")).toBe(2);
    for (const day of ["27", "28", "29", "30", "31"]) expect(weekOfMonth(`2025-01-${day}`)).toBe(5);
    // A month starting on a Monday: Week 1 is a full week.
    expect(weekOfMonth("2025-09-07")).toBe(1);
    expect(weekOfMonth("2025-09-08")).toBe(2);
  });

  it("labels a Weekly report with the week of its Monday's month (FR-030)", () => {
    expect(weeklyLabel("2025-01-27")).toBe(5);
    // December 2024 starts on a Sunday, so Mon 30 Dec is in its sixth week.
    expect(weeklyLabel("2024-12-30")).toBe(6);
  });

  it("cuts a month's weeks at its first and last day", () => {
    expect(monthWeeks("2025-01")).toEqual([
      { week: 1, from: "2025-01-01", to: "2025-01-05" },
      { week: 2, from: "2025-01-06", to: "2025-01-12" },
      { week: 3, from: "2025-01-13", to: "2025-01-19" },
      { week: 4, from: "2025-01-20", to: "2025-01-26" },
      { week: 5, from: "2025-01-27", to: "2025-01-31" },
    ]);
    // February 2026 starts on a Sunday: a one-day Week 1.
    expect(monthWeeks("2026-02")[0]).toEqual({ week: 1, from: "2026-02-01", to: "2026-02-01" });
    expect(monthWeeks("2026-02").at(-1)).toEqual({ week: 5, from: "2026-02-23", to: "2026-02-28" });
  });

  it("handles leap years and whole years", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2027-02")).toEqual({ from: "2027-02-01", to: "2027-02-28" });
    expect(days(monthRange("2028-02"))).toHaveLength(29);
    expect(yearRange(2025)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });

  it("labels each day Mon…Sun and Jan…Dec", () => {
    expect(days({ from: "2025-01-27", to: "2025-02-02" }).map((day) => `${day.dayLabel} ${day.monthLabel} ${day.year}`)).toEqual([
      "Mon Jan 2025", "Tue Jan 2025", "Wed Jan 2025", "Thu Jan 2025", "Fri Jan 2025", "Sat Feb 2025", "Sun Feb 2025",
    ]);
  });

  it("validates each kind of period and refuses dates more than ten years away", () => {
    const today = "2026-10-31";
    expect(validatePeriod("weekly", "2025-01-29", today)).toEqual({ range: { from: "2025-01-27", to: "2025-02-02" }, key: "2025-01-27" });
    expect(validatePeriod("monthly", "2025-01", today)).toEqual({ range: { from: "2025-01-01", to: "2025-01-31" }, key: "2025-01" });
    expect(validatePeriod("yearly", "2025", today)).toEqual({ range: { from: "2025-01-01", to: "2025-12-31" }, key: "2025" });
    expect(validatePeriod("weekly", "2025-02-30", today)).toEqual({ error: "Choose a valid date." });
    expect(validatePeriod("weekly", null, today)).toEqual({ error: "Choose a valid date." });
    expect(validatePeriod("monthly", "2025-13", today)).toEqual({ error: "Choose a valid month." });
    expect(validatePeriod("yearly", "2040", today)).toEqual({ error: "Choose a valid year." });
    expect(validatePeriod("yearly", "2016", today)).toMatchObject({ key: "2016" });
  });

  it("takes default periods from today in the fleet time zone (FR-020)", () => {
    // 17:00 UTC on Jan 31 is already Feb 1 in Manila.
    const defaults = defaultPeriods(new Date("2025-01-31T17:00:00Z"));
    expect(defaults).toEqual({ date: "2025-02-01", month: "2025-02", year: 2025 });
    expect(weekRange(defaults.date).from).toBe("2025-01-27");
  });

  it("describes the week a Weekly report covers", () => {
    expect(weekCoverText("2025-01-29")).toBe("Covers Mon 27 Jan – Sun 2 Feb 2025");
    expect(weekCoverText("2025-01-01")).toBe("Covers Mon 30 Dec 2024 – Sun 5 Jan 2025");
    expect(weekCoverText("")).toBe("");
  });
});
