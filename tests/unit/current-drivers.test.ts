import { describe, expect, it } from "vitest";
import { driversByUnit } from "@/lib/assignments/current-drivers";

describe("driversByUnit (feature 010, FR-050)", () => {
  it("maps each unit to its saved driver with the driver's role", () => {
    const result = driversByUnit([
      { unit_id: "u1", driver_id: "d1", drivers: { full_name: "Juan", driver_kind: "primary" } },
      { unit_id: "u2", driver_id: "d2", drivers: [{ full_name: "Pedro", driver_kind: "backup" }] },
    ]);
    expect(result.get("u1")).toEqual({ driverId: "d1", driverName: "Juan", role: "primary" });
    expect(result.get("u2")).toEqual({ driverId: "d2", driverName: "Pedro", role: "backup" });
  });

  it("treats a driver hidden by RLS (archived) as no driver", () => {
    expect(driversByUnit([{ unit_id: "u1", driver_id: "d1", drivers: null }]).has("u1")).toBe(false);
  });
});
