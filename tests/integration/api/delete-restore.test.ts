import { describe, expect, it } from "vitest";
import { resources } from "@/lib/domain/resource-config";

describe("soft deletion contract", () => {
  it("marks business CRUD resources as soft deletable", () => {
    for (const name of ["units", "drivers", "assignments", "driver-days-off", "mileage-readings", "expense-categories", "expenses", "part-replacements", "tire-installations", "documents"]) expect(resources[name].softDelete).toBe(true);
  });
  it("keeps audit immutable", () => expect(resources["audit-events"].readOnly).toBe(true));
});
