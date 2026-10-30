import { parseCentavos } from "@/lib/money/centavos";
import { fetchListPage, type ListPageRequest } from "@/lib/pagination/list-page";

/**
 * Whole-list search for paged lists (feature 006, research R4). PostgREST cannot OR a base column
 * with an embedded one, so names on related rows (unit body number, driver name, …) are first
 * turned into ids with a small query, then OR-ed in as `foreign_key.in.(…)`. Enum columns cannot
 * use `ilike`, so their display labels are matched here and OR-ed in as `column.in.(…)`.
 */

export interface RelatedSearch { table: "units" | "drivers" | "expense_categories"; column: string; foreignKey: string }
export interface EnumSearch { column: string; labels: Record<string, string> }

export interface SearchSpec {
  columns?: string[];
  related?: RelatedSearch[];
  enums?: EnumSearch[];
  dateColumn?: string;
  amountColumn?: string;
}

export type RelatedIds = Record<string, string[]>;

/** A filter that matches no row, for searches with nothing to match. */
export const matchNothing = "id.is.null";

/** Removes the characters that would break out of a PostgREST `or=(…)` value or act as wildcards. */
export function cleanSearch(q: string) {
  return q.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim();
}

function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function amountTerm(column: string, q: string) {
  if (!/^₱?\s?[\d,]+(\.\d{1,2})?$/.test(q)) return null;
  try { return `${column}.eq.${parseCentavos(q)}`; } catch { return null; }
}

/** Enum values whose label (or raw value) contains the search text. */
export function matchingEnumValues(labels: Record<string, string>, q: string) {
  const needle = q.toLowerCase();
  return Object.entries(labels).filter(([value, label]) => label.toLowerCase().includes(needle) || value.replaceAll("_", " ").includes(needle)).map(([value]) => value);
}

/**
 * Returns the `.or()` filter for a search, or `null` when there is no search. Every term is
 * already escaped; `relatedIds` comes from `findRelatedIds`, keyed by foreign key.
 */
export function buildSearchFilter(spec: SearchSpec, rawQ: string, relatedIds: RelatedIds = {}) {
  const q = cleanSearch(rawQ);
  if (!q) return null;
  const terms: string[] = [];
  for (const column of spec.columns ?? []) terms.push(`${column}.ilike.*${q}*`);
  for (const related of spec.related ?? []) {
    const ids = relatedIds[related.foreignKey] ?? [];
    if (ids.length) terms.push(`${related.foreignKey}.in.(${ids.join(",")})`);
  }
  for (const item of spec.enums ?? []) {
    const values = matchingEnumValues(item.labels, q);
    if (values.length) terms.push(`${item.column}.in.(${values.join(",")})`);
  }
  if (spec.dateColumn && /^\d{4}-\d{2}-\d{2}$/.test(q)) terms.push(`${spec.dateColumn}.eq.${q}`);
  else if (spec.dateColumn && /^\d{4}-(0[1-9]|1[0-2])$/.test(q)) { const { start, end } = monthBounds(q); terms.push(`and(${spec.dateColumn}.gte.${start},${spec.dateColumn}.lte.${end})`); }
  if (spec.amountColumn) { const term = amountTerm(spec.amountColumn, q); if (term) terms.push(term); }
  return terms.length ? terms.join(",") : matchNothing;
}

type IdQuery = { select: (columns: string) => { ilike: (column: string, pattern: string) => { is: (column: string, value: null) => { limit: (count: number) => PromiseLike<{ data: { id: string }[] | null }> } } } };
type SearchClient = { from: (table: RelatedSearch["table"]) => unknown };

/** Ids of related rows whose name matches the search, keyed by the list's foreign key. */
export async function findRelatedIds(client: SearchClient, spec: SearchSpec, rawQ: string): Promise<RelatedIds> {
  const q = cleanSearch(rawQ);
  if (!q || !spec.related?.length) return {};
  const results = await Promise.all(spec.related.map(async (related) => {
    const query = client.from(related.table) as IdQuery;
    const { data } = await query.select("id").ilike(related.column, `%${q}%`).is("deleted_at", null).limit(200);
    return [related.foreignKey, (data ?? []).map((row) => row.id)] as const;
  }));
  const ids: RelatedIds = {};
  for (const [key, values] of results) ids[key] = [...(ids[key] ?? []), ...values];
  return ids;
}

/**
 * One searched, counted page of a list. `run` builds the list's own query (columns, soft-delete
 * filter, order) and applies `filter` with `.or()` when it is not null.
 */
export async function loadListPage<Row>(client: SearchClient, request: ListPageRequest, spec: SearchSpec, run: (from: number, to: number, filter: string | null) => PromiseLike<{ data: Row[] | null; count: number | null }>) {
  const filter = buildSearchFilter(spec, request.q, await findRelatedIds(client, spec, request.q));
  return fetchListPage(request, (from, to) => run(from, to, filter));
}
