import type { Database } from "@/types/database";

/** Fixed expense categories (feature 011, data-model "Enum"). Array order is the display order. */
export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];

export const expenseCategoryOptions = ["change_oil", "front_tire", "rear_tire", "engine_sprocket", "chain", "rear_sprocket", "battery", "others"] as const satisfies readonly ExpenseCategory[];

export type MainCategory = Exclude<ExpenseCategory, "others">;

export const mainCategories = expenseCategoryOptions.filter((category): category is MainCategory => category !== "others");

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  change_oil: "Change Oil",
  front_tire: "Front Tire",
  rear_tire: "Rear Tire",
  engine_sprocket: "Engine Sprocket",
  chain: "Chain",
  rear_sprocket: "Rear Sprocket",
  battery: "Battery",
  others: "Others",
};

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && (expenseCategoryOptions as readonly string[]).includes(value);
}

export function isMainCategory(category: ExpenseCategory | string | null | undefined): category is MainCategory {
  return isExpenseCategory(category) && category !== "others";
}

/** What the table shows in the Category column: the main label, or the typed name for Others. */
export function categoryText(row: { category: ExpenseCategory | string; custom_category?: string | null }) {
  if (row.category === "others") return row.custom_category?.trim() || expenseCategoryLabels.others;
  return isExpenseCategory(row.category) ? expenseCategoryLabels[row.category] : String(row.category);
}

// Normalized part names that map to a main category (research R3). Keep in sync with
// public.maintenance_category_for in supabase/migrations/20261101000600_move_maintenance_into_expenses.sql.
const variants: Record<MainCategory, readonly string[]> = {
  change_oil: ["changeoil", "oilchange", "engineoil", "oil", "motoroil"],
  front_tire: ["fronttire", "fronttyre"],
  rear_tire: ["reartire", "reartyre"],
  engine_sprocket: ["enginesprocket", "sprocketengine", "frontsprocket", "drivesprocket"],
  chain: ["chain", "drivechain"],
  rear_sprocket: ["rearsprocket", "sprocketrear", "drivensprocket"],
  battery: ["battery"],
};

export function normalizeCategoryName(name: string) {
  return name.toLowerCase().replaceAll("&", "and").replace(/[^a-z]/g, "");
}

/** The main category a free-typed name stands for, or null. Exact match on the normalized name. */
export function mainCategoryFor(name: string): MainCategory | null {
  const key = normalizeCategoryName(name);
  if (!key) return null;
  for (const category of mainCategories) if (variants[category].includes(key)) return category;
  return null;
}

/** Trims and collapses inner whitespace, as the database does (normalize_expense). */
export function cleanCategoryName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}
