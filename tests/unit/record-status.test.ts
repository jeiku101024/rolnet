import { describe, expect, it } from "vitest";
import { driverStatusOf, isDriverLocked, isUnitLocked, lockedMessage } from "@/lib/status/record-status";
import { unitDetailsSchema, unitStatusSchema } from "@/lib/validation/units";
import { driverDetailsSchema, driverStatusSchema } from "@/lib/validation/drivers";

const id = "00000000-0000-4000-8000-000000000001";
const updatedAt = "2026-10-29T08:00:00.123456+00:00";

describe("record status (feature 005)", () => {
  it("locks In repair and Retired units and Inactive drivers", () => {
    expect(isUnitLocked("active")).toBe(false);
    expect(isUnitLocked("in_repair")).toBe(true);
    expect(isUnitLocked("retired")).toBe(true);
    expect(isDriverLocked(true)).toBe(false);
    expect(isDriverLocked(false)).toBe(true);
    expect(driverStatusOf(false)).toBe("inactive");
  });

  it("names the status and the recovery step in the locked notice", () => {
    expect(lockedMessage("unit", "in_repair")).toBe("This unit is In repair. Set the status to Active to edit its details.");
    expect(lockedMessage("unit", "retired")).toBe("This unit is Retired. Set the status to Active to edit its details.");
    expect(lockedMessage("driver", "inactive")).toBe("This driver is Inactive. Set the status to Active to edit their details.");
  });

  it("validates status changes", () => {
    expect(unitStatusSchema.safeParse({ id, status: "in_repair", expectedStatus: "active" }).success).toBe(true);
    expect(unitStatusSchema.safeParse({ id: "not-a-uuid", status: "in_repair", expectedStatus: "active" }).success).toBe(false);
    expect(unitStatusSchema.safeParse({ id, status: "scrapped", expectedStatus: "active" }).success).toBe(false);
    expect(unitStatusSchema.safeParse({ id, status: "active" }).success).toBe(false);
    expect(driverStatusSchema.safeParse({ id, status: "inactive", expectedStatus: "active" }).success).toBe(true);
    expect(driverStatusSchema.safeParse({ id, status: "left", expectedStatus: "active" }).success).toBe(false);
  });

  it("requires the loaded version on detail edits and never accepts a status there", () => {
    const unit = { bodyNumber: "12", plateNumber: "ABC 123", makeModel: "Honda TMX" };
    expect(unitDetailsSchema.safeParse({ ...unit, expectedUpdatedAt: updatedAt }).success).toBe(true);
    expect(unitDetailsSchema.safeParse(unit).success).toBe(false);
    expect(unitDetailsSchema.parse({ ...unit, status: "retired", expectedUpdatedAt: updatedAt })).not.toHaveProperty("status");
    const driver = { fullName: "Juan", driverKind: "primary", licenseNumber: "N01", licenseExpiryDate: "2030-01-01", phone: "0917" };
    expect(driverDetailsSchema.safeParse({ ...driver, expectedUpdatedAt: updatedAt }).success).toBe(true);
    expect(driverDetailsSchema.safeParse(driver).success).toBe(false);
  });
});
