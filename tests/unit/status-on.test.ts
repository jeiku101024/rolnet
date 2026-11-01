import { describe, expect, it } from "vitest";
import { existsOn, isBlocked, statusOn, type StatusChange } from "@/lib/units/status-on";

const change = (from_status: StatusChange["from_status"], to_status: StatusChange["to_status"], effective_on: string, time = "09:00"): StatusChange =>
  ({ from_status, to_status, effective_on, changed_at: `${effective_on}T${time}:00+08:00` });

// Same cases as supabase/tests/constraints/290_unit_status_blocking.sql.
const history = [
  change("active", "in_repair", "2030-11-01"),
  change("in_repair", "active", "2030-11-05", "08:00"),
  change("active", "retired", "2030-11-05", "17:00"),
];

describe("statusOn (feature 010, FR-024)", () => {
  it("uses the previous status before the first change", () => {
    expect(statusOn(history, "2030-10-31")).toBe("active");
  });
  it("applies a change from its effective date, with no end date", () => {
    expect(statusOn(history, "2030-11-01")).toBe("in_repair");
    expect(statusOn(history, "2030-11-04")).toBe("in_repair");
  });
  it("resolves two changes on one day to the later one", () => {
    expect(statusOn(history, "2030-11-05")).toBe("retired");
  });
  it("uses the current status for a future date", () => {
    expect(statusOn(history, "2031-01-01")).toBe("retired");
  });
  it("is Active with no history, and with only a creation row the creation status applies", () => {
    expect(statusOn([], "2030-11-05")).toBe("active");
    expect(statusOn([change(null, "in_repair", "2030-11-01")], "2030-11-02")).toBe("in_repair");
    expect(statusOn([change(null, "in_repair", "2030-11-01")], "2030-10-31")).toBe("active");
  });
  it("doesn't depend on the order rows arrive in", () => {
    expect(statusOn([...history].reverse(), "2030-11-05")).toBe("retired");
  });
});

describe("isBlocked and existsOn", () => {
  it("blocks In repair and Retired only", () => {
    expect(isBlocked("in_repair")).toBe(true);
    expect(isBlocked("retired")).toBe(true);
    expect(isBlocked("active")).toBe(false);
  });
  it("counts a unit from the Manila day it was added", () => {
    // 23:30 Manila on Nov 1 is 15:30 UTC: still Nov 1 in the fleet time zone.
    expect(existsOn("2030-11-01T15:30:00Z", "2030-11-01")).toBe(true);
    expect(existsOn("2030-11-01T15:30:00Z", "2030-10-31")).toBe(false);
    // 00:30 Manila on Nov 2 is 16:30 UTC on Nov 1.
    expect(existsOn("2030-11-01T16:30:00Z", "2030-11-01")).toBe(false);
  });
});
