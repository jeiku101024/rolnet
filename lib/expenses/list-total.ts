import { applyFilters, type ParsedControls } from "@/lib/pagination/list-controls";

const pageSize = 1000;

type AmountRows = PromiseLike<{ data: { amount_centavos: number | string }[] | null; error?: unknown }>;
/** The slice of a Supabase query this needs (the real client satisfies it). */
export interface AmountQuery {
  is(column: string, value: null): AmountQuery;
  or(filter: string): AmountQuery;
  order(column: string, options: { ascending: boolean }): AmountQuery;
  range(from: number, to: number): AmountRows;
}

/**
 * Peso total of every expense matching the page's search and filters (feature 011, FR-007,
 * research R8). It applies the very same `.or()` search filter and `applyFilters` as the table, so
 * the total always matches the count. Reads in pages of 1000, summing integer centavos.
 */
export async function loadExpenseTotal(select: () => AmountQuery, controls: ParsedControls, searchFilter: string | null, count: number) {
  if (count <= 0) return 0;
  let total = 0;
  for (let from = 0; from < count; from += pageSize) {
    let query = applyFilters(select().is("deleted_at", null), controls);
    if (searchFilter) query = query.or(searchFilter);
    const { data, error } = await query.order("id", { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) total += Number(row.amount_centavos);
    if (rows.length < pageSize) break;
  }
  return total;
}

/** Demo mode: the same total over rows already filtered in memory. */
export function sumAmounts(rows: { amount_centavos: number }[]) {
  return rows.reduce((sum, row) => sum + row.amount_centavos, 0);
}
