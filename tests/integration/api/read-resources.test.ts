import { describe, expect, it } from "vitest";
import { resources } from "@/lib/domain/resource-config";
import { parsePage } from "@/lib/api/pagination";

describe("read resource contract", () => {
  it("covers all sixteen lifecycle entities, including daily unit assignments (feature 010)", () => expect(Object.keys(resources)).toHaveLength(16));
  it("gives every resource deterministic sorts", () => {
    for (const value of Object.values(resources)) expect(value.sortFields).toContain(value.defaultSort);
  });
  it("returns stable page metadata inputs", () => expect(parsePage(new URL("https://rolnet.test/api/v1/units?page=2"), resources.units.sortFields)).toMatchObject({ page: 2, pageSize: 25, from: 25, to: 49 }));
});
