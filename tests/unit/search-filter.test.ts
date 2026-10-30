import { describe, expect, it } from "vitest";
import { buildSearchFilter, cleanSearch, findRelatedIds, matchNothing } from "@/lib/pagination/search-filter";
import { unitStatusLabels, driverKindLabels } from "@/lib/pagination/search-specs";

describe("whole-list search filter (feature 006)", () => {
  it("strips characters that could break out of the or() filter", () => {
    expect(cleanSearch("a,b)(c*d%e\\f:g\"h'i")).toBe("a b c d e f g h i");
    expect(buildSearchFilter({ columns: ["notes"] }, "x),id.not.is.null")).toBe("notes.ilike.*x id.not.is.null*");
    expect(buildSearchFilter({ columns: ["notes"] }, "  ")).toBeNull();
    expect(buildSearchFilter({ columns: ["notes"] }, "(((")).toBeNull();
  });

  it("matches enum columns by their display labels", () => {
    expect(buildSearchFilter({ enums: [{ column: "status", labels: unitStatusLabels }] }, "repair")).toBe("status.in.(in_repair)");
    expect(buildSearchFilter({ enums: [{ column: "driver_kind", labels: driverKindLabels }] }, "backup")).toBe("driver_kind.in.(backup)");
    expect(buildSearchFilter({ enums: [{ column: "status", labels: unitStatusLabels }] }, "zzz")).toBe(matchNothing);
  });

  it("adds related ids, dates and peso amounts", () => {
    const spec = { columns: ["notes"], related: [{ table: "drivers" as const, column: "full_name", foreignKey: "driver_id" }], dateColumn: "service_date", amountColumn: "amount_due_centavos" };
    expect(buildSearchFilter(spec, "juan", { driver_id: ["a", "b"] })).toBe("notes.ilike.*juan*,driver_id.in.(a,b)");
    expect(buildSearchFilter(spec, "juan", { driver_id: [] })).toBe("notes.ilike.*juan*");
    expect(buildSearchFilter(spec, "2026-10-19")).toBe("notes.ilike.*2026-10-19*,service_date.eq.2026-10-19");
    expect(buildSearchFilter(spec, "2026-02")).toBe("notes.ilike.*2026-02*,and(service_date.gte.2026-02-01,service_date.lte.2026-02-28)");
    expect(buildSearchFilter(spec, "180")).toBe("notes.ilike.*180*,amount_due_centavos.eq.18000");
  });

  it("looks up related ids only for active rows", async () => {
    const calls: string[] = [];
    const client = { from: (table: string) => ({ select: () => ({ ilike: (column: string, pattern: string) => ({ is: (deleted: string) => ({ limit: async () => { calls.push(`${table}.${column}.${pattern}.${deleted}`); return { data: [{ id: `${table}-1` }] }; } }) }) }) }) };
    const ids = await findRelatedIds(client, { related: [{ table: "units", column: "body_number", foreignKey: "unit_id" }] }, "T-0");
    expect(ids).toEqual({ unit_id: ["units-1"] });
    expect(calls).toEqual(["units.body_number.%T-0%.deleted_at"]);
    expect(await findRelatedIds(client, { related: [] }, "x")).toEqual({});
  });
});
