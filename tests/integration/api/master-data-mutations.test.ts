import { describe, expect, it } from "vitest";
import { resources } from "@/lib/domain/resource-config";

describe("master data contract", () => {
  it("reserves master writes for owners", () => {
    for (const name of ["units", "drivers", "expense-categories", "documents", "profiles", "fleet-settings"]) expect(resources[name].ownerWrite).toBe(true);
  });
  it("keeps the retired assignment model and daily assignments read-only (feature 010)", () => {
    for (const name of ["assignments", "driver-days-off", "unit-assignments"]) expect(resources[name]).toMatchObject({ readOnly: true, createFields: [], updateFields: [] });
  });
  it("keeps settings singleton", () => expect(resources["fleet-settings"]).toMatchObject({ singleton: true, createFields: [] }));
  it("keeps document storage fields hidden", () => expect(resources.documents.hiddenFields).toEqual(expect.arrayContaining(["object_path", "sha256"])));
});
