import { describe, expect, it } from "vitest";
import { categoryText, cleanCategoryName, expenseCategoryLabels, expenseCategoryOptions, isMainCategory, mainCategories, mainCategoryFor } from "@/lib/expenses/categories";

describe("expense categories", () => {
  it("lists the 7 main categories in client order, then Others", () => {
    expect(expenseCategoryOptions.map((value) => expenseCategoryLabels[value])).toEqual(["Change Oil", "Front Tire", "Rear Tire", "Engine Sprocket", "Chain", "Rear Sprocket", "Battery", "Others"]);
    expect(mainCategories).toHaveLength(7);
    expect(mainCategories).not.toContain("others");
  });

  it("tells main categories from Others", () => {
    expect(isMainCategory("chain")).toBe(true);
    expect(isMainCategory("others")).toBe(false);
    expect(isMainCategory("fuel")).toBe(false);
    expect(isMainCategory(null)).toBe(false);
  });

  it("shows the label, or the typed name for Others", () => {
    expect(categoryText({ category: "rear_sprocket", custom_category: null })).toBe("Rear Sprocket");
    expect(categoryText({ category: "others", custom_category: "Brake pads" })).toBe("Brake pads");
    expect(categoryText({ category: "others", custom_category: null })).toBe("Others");
  });

  it("collapses whitespace like the database", () => {
    expect(cleanCategoryName("  Brake   pads ")).toBe("Brake pads");
  });

  it.each([
    ["changeoil", "change_oil"], ["oilchange", "change_oil"], ["engineoil", "change_oil"], ["oil", "change_oil"], ["motoroil", "change_oil"],
    ["fronttire", "front_tire"], ["fronttyre", "front_tire"],
    ["reartire", "rear_tire"], ["reartyre", "rear_tire"],
    ["enginesprocket", "engine_sprocket"], ["sprocketengine", "engine_sprocket"], ["frontsprocket", "engine_sprocket"], ["drivesprocket", "engine_sprocket"],
    ["chain", "chain"], ["drivechain", "chain"],
    ["rearsprocket", "rear_sprocket"], ["sprocketrear", "rear_sprocket"], ["drivensprocket", "rear_sprocket"],
    ["battery", "battery"],
  ])("maps the variant %s to %s", (name, category) => {
    expect(mainCategoryFor(name)).toBe(category);
  });

  it.each([["Change-Oil", "change_oil"], ["Oil change", "change_oil"], ["Drive Chain", "chain"], ["Sprocket (rear)", "rear_sprocket"], ["Engine oil", "change_oil"]])("ignores case and punctuation in %s", (name, category) => {
    expect(mainCategoryFor(name)).toBe(category);
  });

  it.each(["Brake pads", "Spark plug", "Air filter", "Rear left tire (Dunlop)", "", "   "])("leaves %j as Others", (name) => {
    expect(mainCategoryFor(name)).toBeNull();
  });
});
