import { describe, expect, it } from "vitest";
import { resources } from "@/lib/domain/resource-config";

describe("operational mutation contract", () => {
  it("keeps remittance identity immutable", () => expect(resources.remittances.updateFields).toEqual(["notes"]));
  it("requires retry identities for money creates", () => {
    for (const name of ["expenses", "remittances", "remittance-payments"]) expect(resources[name].idempotent).toBe(true);
  });
  it("allows staff operations through encode permission", () => {
    for (const name of ["mileage-readings", "expenses", "remittances", "part-replacements", "tire-installations"]) expect(resources[name].writePermission).toBe("encode_operations");
  });
});
