import { describe, expect, it } from "vitest";
import { resources } from "@/lib/domain/resource-config";

describe("soft deletion contract", () => {
  it("marks business CRUD resources as soft deletable", () => {
    for (const name of ["units", "drivers", "assignments", "driver-days-off", "mileage-readings", "expenses", "documents"]) expect(resources[name].softDelete).toBe(true);
  });
  it("stops deleting the retired maintenance resources (feature 011)", () => {
    for (const name of ["expense-categories", "part-replacements", "tire-installations"]) expect(resources[name].softDelete).toBe(false);
  });
  it("keeps audit immutable", () => expect(resources["audit-events"].readOnly).toBe(true));
});
