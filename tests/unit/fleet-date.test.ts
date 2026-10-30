import { describe, expect, it } from "vitest";
import { fleetToday, formatLongDate, formatShortDate, isAfterToday, paymentTimestampFor } from "@/lib/dates/fleet-date";

describe("fleet date helpers (feature 008)", () => {
  it("formats long and short dates", () => {
    expect(formatLongDate("2026-10-30")).toBe("Friday, October 30, 2026");
    expect(formatShortDate("2026-10-28")).toBe("Oct 28");
  });

  it("compares calendar dates", () => {
    expect(isAfterToday("2026-10-31", "2026-10-30")).toBe(true);
    expect(isAfterToday("2026-10-30", "2026-10-30")).toBe(false);
  });

  it("dates today's payments now", () => {
    const now = new Date("2026-10-30T03:15:00Z");
    expect(paymentTimestampFor(fleetToday(now), now)).toBe(now.toISOString());
  });

  it("dates a past card's payment at noon of that date in the fleet time zone", () => {
    const now = new Date("2026-11-02T03:15:00Z");
    const stamp = paymentTimestampFor("2026-10-28", now);
    expect(stamp).toBe("2026-10-28T12:00:00+08:00");
    expect(fleetToday(new Date(stamp))).toBe("2026-10-28");
  });
});
