import { describe, expect, it } from "vitest";
import { resources } from "@/lib/domain/resource-config";

describe("master data contract", () => {
  it("reserves master writes for owners", () => {
    for (const name of ["units", "drivers", "assignments", "driver-days-off", "expense-categories", "documents", "profiles", "fleet-settings"]) expect(resources[name].ownerWrite).toBe(true);
  });
  it("keeps settings singleton", () => expect(resources["fleet-settings"]).toMatchObject({ singleton: true, createFields: [] }));
  it("keeps document storage fields hidden", () => expect(resources.documents.hiddenFields).toEqual(expect.arrayContaining(["object_path", "sha256"])));
});
