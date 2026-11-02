import { describe, expect, it } from "vitest";
import { availability } from "@/lib/drivers/availability";

const driver = (id: string, full_name: string, over: Partial<{ is_active: boolean; license_expiry_date: string; driver_kind: "primary" | "backup" }> = {}) =>
  ({ id, full_name, driver_kind: "primary" as const, is_active: true, license_expiry_date: "2030-12-31", ...over });
const leave = (driver_id: string, start_date: string, end_date: string | null) => ({ driver_id, start_date, end_date, cancelled_at: null, ended_early_on: null });

describe("availability (feature 012, FR-040)", () => {
  const drivers = [
    driver("d1", "Cora"),
    driver("d2", "Ana", { driver_kind: "backup" }),
    driver("d3", "Ben", { is_active: false }),
    driver("d4", "Dina", { license_expiry_date: "2026-01-01" }),
    driver("d5", "Eli"),
  ];

  it("offers only active, present, licensed, unassigned drivers, sorted by name with their role", () => {
    const result = availability({ drivers, absences: [leave("d5", "2026-11-05", "2026-11-09")], assignedDriverIds: ["d1"], date: "2026-11-06" });
    expect(result.available).toEqual([{ id: "d2", name: "Ana", role: "backup" }]);
    expect(result.hidden).toEqual({ inactive: 1, absent: 1, licenceExpired: 1, assigned: 1 });
  });

  it("is per date: a driver on leave Nov 5 to 9 is available on Nov 4 and Nov 10", () => {
    const absences = [leave("d5", "2026-11-05", "2026-11-09")];
    const ids = (date: string) => availability({ drivers, absences, assignedDriverIds: [], date }).available.map((d) => d.id);
    expect(ids("2026-11-04")).toContain("d5");
    expect(ids("2026-11-05")).not.toContain("d5");
    expect(ids("2026-11-10")).toContain("d5");
  });

  it("counts each hidden driver once, by the first matching reason", () => {
    const result = availability({ drivers: [driver("x", "Inactive and absent", { is_active: false })], absences: [leave("x", "2026-11-01", null)], assignedDriverIds: ["x"], date: "2026-11-06" });
    expect(result.hidden).toEqual({ inactive: 1, absent: 0, licenceExpired: 0, assigned: 0 });
  });
});
