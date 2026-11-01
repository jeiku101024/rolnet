import { describe, expect, it } from "vitest";
import { parseUnitsView, unitsDailyHref, unitsListHref } from "@/lib/units/view-params";

const today = "2026-11-01";

describe("parseUnitsView (feature 010)", () => {
  it("opens List view for the owner by default", () => {
    expect(parseUnitsView({}, today, true)).toEqual({ view: "list", date: today });
  });
  it("opens the Daily assignment view when asked", () => {
    expect(parseUnitsView({ view: "daily", date: "2026-10-30" }, today, true)).toEqual({ view: "daily", date: "2026-10-30" });
  });
  it("always gives staff the Daily assignment view (FR-056)", () => {
    expect(parseUnitsView({ view: "list" }, today, false).view).toBe("daily");
    expect(parseUnitsView({}, today, false).view).toBe("daily");
  });
  it("allows future dates for planning (FR-009)", () => {
    expect(parseUnitsView({ view: "daily", date: "2026-12-25" }, today, true).date).toBe("2026-12-25");
  });
  it("falls back to today for a missing or invalid date", () => {
    expect(parseUnitsView({ view: "daily", date: "2026-02-30" }, today, true).date).toBe(today);
    expect(parseUnitsView({ view: "daily", date: "soon" }, today, true).date).toBe(today);
  });
});

describe("Units links", () => {
  it("builds the Daily assignment and List view addresses", () => {
    expect(unitsDailyHref("2026-11-01")).toBe("/units?view=daily&date=2026-11-01");
    expect(unitsDailyHref()).toBe("/units?view=daily");
    expect(unitsListHref()).toBe("/units");
  });
});
