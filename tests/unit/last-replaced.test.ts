import { describe, expect, it } from "vitest";
import { lastReplacedByCategory } from "@/lib/expenses/last-replaced";

describe("lastReplacedByCategory (feature 011, FR-033)", () => {
  it("lists the 7 main categories in order with the latest date replaced, ignoring Others", () => {
    const result = lastReplacedByCategory([
      { category: "chain", replaced_date: "2026-09-01" },
      { category: "chain", replaced_date: "2026-10-15" },
      { category: "chain", replaced_date: "2026-08-20" },
      { category: "battery", replaced_date: "2026-07-01" },
      { category: "others", replaced_date: null },
    ]);
    expect(result.map((row) => row.label)).toEqual(["Change Oil", "Front Tire", "Rear Tire", "Engine Sprocket", "Chain", "Rear Sprocket", "Battery"]);
    expect(result.find((row) => row.category === "chain")?.replacedDate).toBe("2026-10-15");
    expect(result.find((row) => row.category === "battery")?.replacedDate).toBe("2026-07-01");
    expect(result.find((row) => row.category === "change_oil")?.replacedDate).toBeNull();
  });

  it("returns every category as never recorded when there are no rows", () => {
    expect(lastReplacedByCategory([]).every((row) => row.replacedDate === null)).toBe(true);
  });
});
