import { describe, expect, it } from "vitest";
import { fileNamePart, sheetNames, sortUnits } from "@/lib/reports/sheet-names";
import { sheetRef } from "@/lib/reports/xlsx";

describe("sortUnits (research R8)", () => {
  it("puts numbers in value order: rolnet-1, rolnet-2 … rolnet-10 … rolnet-100", () => {
    const units = ["rolnet-10", "rolnet-100", "rolnet-2", "rolnet-1", "rolnet-11", "rolnet-9"].map((name, index) => ({ id: String(index), name }));
    expect(sortUnits(units).map((unit) => unit.name)).toEqual(["rolnet-1", "rolnet-2", "rolnet-9", "rolnet-10", "rolnet-11", "rolnet-100"]);
  });

  it("ignores letter case and breaks ties by id", () => {
    const sorted = sortUnits([{ id: "b", name: "Rolnet-1" }, { id: "a", name: "rolnet-1" }, { id: "c", name: "ROLNET-02" }]);
    expect(sorted.map((unit) => unit.id)).toEqual(["a", "b", "c"]);
  });
});

describe("sheetNames (spec FR-012)", () => {
  it("keeps ordinary names", () => {
    expect(sheetNames(["rolnet-1", "rolnet-2"])).toEqual(["rolnet-1", "rolnet-2"]);
  });

  it("replaces forbidden characters with a dash", () => {
    expect(sheetNames(["A:B\\C/D?E*F[G]H"])).toEqual(["A-B-C-D-E-F-G-H"]);
  });

  it("trims leading and trailing apostrophes and spaces, and fills an empty result", () => {
    expect(sheetNames(["'Ben's'", "  Pedro  ", "''", ""])).toEqual(["Ben's", "Pedro", "Unit", "Unit (2)"]);
  });

  it("cuts to 31 characters", () => {
    const [name] = sheetNames(["x".repeat(45)]);
    expect(name).toHaveLength(31);
  });

  it("adds (2), (3) to duplicates, staying within 31 characters", () => {
    const long = "A very long unit name that goes past the limit";
    const [first, second, third] = sheetNames([long, `${long} too`, long.toUpperCase()]);
    expect(first).toHaveLength(31);
    expect(second).toBe(`${first.slice(0, 27).trimEnd()} (2)`);
    expect(second.length).toBeLessThanOrEqual(31);
    expect(third.toLowerCase().endsWith(" (3)")).toBe(true);
    expect(new Set([first, second, third].map((name) => name.toLowerCase())).size).toBe(3);
  });

  it("renames a unit called All units, in any letter case", () => {
    expect(sheetNames(["All units", "all UNITS"])).toEqual(["All units (unit)", "all UNITS (unit) (2)"]);
  });

  it("quotes names in references and doubles apostrophes", () => {
    expect(sheetRef(sheetNames(["Mang Ben's"])[0])).toBe("'Mang Ben''s'");
    expect(sheetRef("rolnet-1")).toBe("'rolnet-1'");
  });
});

describe("fileNamePart (spec FR-006)", () => {
  it("keeps rolnet-1 as is", () => {
    expect(fileNamePart("rolnet-1")).toBe("rolnet-1");
  });

  it("removes forbidden characters and turns spaces into dashes", () => {
    expect(fileNamePart('Mang Ben: "North" <1>/2|3?*\\')).toBe("Mang-Ben-North-123");
  });

  it("trims dots and dashes and falls back to unit", () => {
    expect(fileNamePart("..-x-..")).toBe("x");
    expect(fileNamePart("***")).toBe("unit");
  });
});
