import { describe, expect, it } from "vitest";
import { datePresets, matchingPreset, rangeText } from "@/lib/pagination/date-presets";

// 2026-10-30 is a Friday.
const today = "2026-10-30";

describe("list date presets (feature 006, US8)", () => {
  it("ends every preset today and starts weeks on Monday", () => {
    expect(datePresets(today).map((preset) => [preset.value, preset.from, preset.to])).toEqual([
      ["today", "2026-10-30", "2026-10-30"],
      ["yesterday", "2026-10-29", "2026-10-29"],
      ["week", "2026-10-26", "2026-10-30"],
      ["month", "2026-10-01", "2026-10-30"],
    ]);
    expect(datePresets("2026-11-01").find((preset) => preset.value === "week")?.from).toBe("2026-10-26");
  });

  it("names the current range for the date button", () => {
    expect(rangeText(undefined, undefined, today)).toBe("Any date");
    expect(rangeText("2026-10-01", "2026-10-30", today)).toBe("This month");
    expect(rangeText("2026-10-01", "2026-10-15", today)).toBe("Oct 1 – Oct 15");
    expect(rangeText("2026-10-05", "2026-10-05", today)).toBe("Oct 5");
    expect(rangeText("2025-12-01", undefined, today)).toBe("From Dec 1, 2025");
    expect(rangeText(undefined, "2026-10-15", today)).toBe("Until Oct 15");
    expect(matchingPreset("2026-10-01", "2026-10-29", today)).toBeUndefined();
  });
});
