import { describe, expect, it } from "vitest";
import { resources } from "@/lib/domain/resource-config";

describe("DTO redaction policy", () => {
  it("redacts every private object locator and checksum", () => {
    expect(resources.expenses.hiddenFields).toEqual(expect.arrayContaining(["receipt_object_path", "receipt_sha256"]));
    expect(resources.documents.hiddenFields).toEqual(expect.arrayContaining(["object_path", "sha256"]));
  });
});
