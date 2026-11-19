import { describe, expect, it } from "vitest";
import { currentMonthDefaults, isDownloadableMonth, monthChoices, yearChoices } from "@/lib/reports/download-years";

describe("download month and year choices (feature 019)", () => {
  const today = "2026-11-19";

  it("lists years from the earliest recorded year to this year, newest first", () => {
    expect(yearChoices("2024-03-05", today)).toEqual([2026, 2025, 2024]);
  });

  it("never goes more than ten years back and falls back to ten years without data", () => {
    expect(yearChoices("2001-01-01", today)).toHaveLength(11);
    expect(yearChoices("2001-01-01", today).at(-1)).toBe(2016);
    expect(yearChoices(null, today).at(-1)).toBe(2016);
  });

  it("stops at the current month in the current year only", () => {
    expect(monthChoices(2026, today).map((choice) => choice.value)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"]);
    expect(monthChoices(2025, today)).toHaveLength(12);
    expect(monthChoices(2026, "2026-01-02")).toEqual([{ value: "01", label: "Jan" }]);
  });

  it("defaults to the current month and year", () => {
    expect(currentMonthDefaults(today)).toEqual({ month: "11", year: "2026" });
  });

  it("accepts only real months up to now and within ten years", () => {
    expect(isDownloadableMonth("2026-11", today)).toBe(true);
    expect(isDownloadableMonth("2026-12", today)).toBe(false);
    expect(isDownloadableMonth("2026-13", today)).toBe(false);
    expect(isDownloadableMonth("2015-12", today)).toBe(false);
    expect(isDownloadableMonth("2016-01", today)).toBe(true);
    expect(isDownloadableMonth(null, today)).toBe(false);
    expect(isDownloadableMonth("nope", today)).toBe(false);
  });
});
