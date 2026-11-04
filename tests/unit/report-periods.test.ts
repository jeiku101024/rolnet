import { describe, expect, it } from "vitest";
import { days, defaultPeriods, excelSerial, monthRange, monthTitle, monthWeeks, rangeLabel, validatePeriod, weekOfMonth, weekRange, weekRangeText, weekTitle, yearRange } from "@/lib/reports/periods";

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

});

describe("report period texts and Excel dates (feature 014, research R9)", () => {
  it("turns a calendar date into Excel's date serial", () => {
    expect(excelSerial("2026-10-01")).toBe(46296);
    expect(excelSerial("1900-03-01")).toBe(61);
    expect(excelSerial("2026-01-01") + 31).toBe(excelSerial("2026-02-01"));
  });

  it("titles a month with its English name", () => {
    expect(monthTitle("2026-10")).toBe("October 2026");
    expect(monthTitle("2027-01")).toBe("January 2027");
  });

  it("labels a block's range with an en dash and no spaces", () => {
    expect(rangeLabel("2026-10-01", "2026-10-04")).toBe("Oct 1–4");
    expect(rangeLabel("2026-10-05", "2026-10-11")).toBe("Oct 5–11");
    expect(rangeLabel("2026-11-01", "2026-11-01")).toBe("Nov 1");
    expect(rangeLabel("2026-10-26", "2026-11-01")).toBe("Oct 26–Nov 1");
    expect(rangeLabel("2026-12-28", "2027-01-03")).toBe("Dec 28–Jan 3");
  });

  it("titles a week within a month, across months and across years", () => {
    expect(weekTitle("2026-10-19")).toBe("Week of Oct 19 – 25, 2026");
    expect(weekTitle("2026-10-26")).toBe("Week of Oct 26 – Nov 1, 2026");
    expect(weekTitle("2026-12-28")).toBe("Week of Dec 28, 2026 – Jan 3, 2027");
  });

  it("shows the week range under the weekly date picker", () => {
    expect(weekRangeText("2026-10-28")).toBe("Oct 26 – Nov 1, 2026");
    expect(weekRangeText("2026-11-01")).toBe("Oct 26 – Nov 1, 2026");
    expect(weekRangeText("2026-10-21")).toBe("Oct 19 – 25, 2026");
    expect(weekRangeText("not a date")).toBe("");
  });

  it("splits October 2026 into five blocks and November 2026 into six, the first being one day", () => {
    expect(monthWeeks("2026-10").map((block) => rangeLabel(block.from, block.to))).toEqual(["Oct 1–4", "Oct 5–11", "Oct 12–18", "Oct 19–25", "Oct 26–31"]);
    const november = monthWeeks("2026-11").map((block) => rangeLabel(block.from, block.to));
    expect(november).toEqual(["Nov 1", "Nov 2–8", "Nov 9–15", "Nov 16–22", "Nov 23–29", "Nov 30"]);
  });
});
