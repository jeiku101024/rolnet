import { expenseCategoryLabels, mainCategories, type ExpenseCategory, type MainCategory } from "@/lib/expenses/categories";

export type LastReplaced = { category: MainCategory; label: string; replacedDate: string | null };

/**
 * The latest date replaced per main category, in the fixed order (feature 011, FR-033). Others never
 * count; a category with no expense shows as `null` ("Never recorded"). Pass non-deleted rows only.
 */
export function lastReplacedByCategory(rows: readonly { category: ExpenseCategory | string; replaced_date: string | null }[]): LastReplaced[] {
  const latest = new Map<string, string>();
  for (const row of rows) {
    if (row.category === "others" || !row.replaced_date) continue;
    const current = latest.get(row.category);
    if (!current || row.replaced_date > current) latest.set(row.category, row.replaced_date);
  }
  return mainCategories.map((category) => ({ category, label: expenseCategoryLabels[category], replacedDate: latest.get(category) ?? null }));
}
