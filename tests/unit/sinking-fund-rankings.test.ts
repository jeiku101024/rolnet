import { describe, expect, it } from "vitest";
import { periodRange, placeLabel, rankRows, trophyFor, weekStart } from "@/lib/sinking-fund/rankings";

const row = (name: string, amount: number) => ({ participant_id: name, name, driver_id: null, amount_centavos: amount });

describe("ranking", () => {
  it("ranks highest first with ties sharing a rank (1, 1, 3) and ordered by name", () => {
    const ranked = rankRows([row("Cy", 500), row("Ana", 900), row("Bo", 900), row("Di", 100)]);
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([["Ana", 1], ["Bo", 1], ["Cy", 3], ["Di", 4]]);
  });

  it("lists zero amounts last without a rank or trophy", () => {
    const ranked = rankRows([row("Zed", 0), row("Ana", 10)]);
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([["Ana", 1], ["Zed", 0]]);
    expect(trophyFor(0)).toBeNull();
  });

  it("gives gold, silver, and bronze trophies with accessible labels", () => {
    expect([1, 2, 3, 4].map(trophyFor)).toEqual(["gold", "silver", "bronze", null]);
    expect([1, 2, 3].map(placeLabel)).toEqual(["1st place", "2nd place", "3rd place"]);
  });
});

describe("periods", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-11-13")).toBe("2026-11-09"); // Friday
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // Sunday
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
  });

  it("runs the current month to today and offers previous but no next", () => {
    expect(periodRange("month", undefined, "2026-11-13")).toMatchObject({ start: "2026-11-01", end: "2026-11-13", label: "November 2026", previous: "2026-10", next: null });
  });

  it("uses a past month in full and offers a next month", () => {
    expect(periodRange("month", "2026-09", "2026-11-13")).toMatchObject({ start: "2026-09-01", end: "2026-09-30", previous: "2026-08", next: "2026-10" });
  });

  it("does not allow a future month", () => {
    expect(periodRange("month", "2027-01", "2026-11-13").key).toBe("2026-11");
  });

  it("runs Monday to Sunday for weeks and stops at the current week", () => {
    expect(periodRange("week", undefined, "2026-11-13")).toMatchObject({ start: "2026-11-09", end: "2026-11-13", previous: "2026-11-02", next: null });
    expect(periodRange("week", "2026-11-02", "2026-11-13")).toMatchObject({ start: "2026-11-02", end: "2026-11-08", next: "2026-11-09" });
  });

  it("has no dates for all time", () => {
    expect(periodRange("all", undefined, "2026-11-13")).toMatchObject({ start: null, end: null, label: "All time" });
  });
});
