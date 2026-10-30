/**
 * Server-side list paging shared by every record list (feature 006, research R1–R3).
 * Page and search live in the URL as `${prefix}page` and `${prefix}q`, so a refresh, a shared
 * link or the browser's Back button returns the same slice.
 */

export const pageSize = 10;
export const maxSearchLength = 100;

export type SearchParams = Record<string, string | string[] | undefined>;

export interface ListPageRequest { prefix: string; page: number; q: string; from: number; to: number }
export interface ListPageState { page: number; lastPage: number; total: number; rangeLabel: string }

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function rangeFor(page: number) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** Reads one list's page and search text. Anything that is not a whole number ≥ 1 is page 1. */
export function parseListPage(searchParams: SearchParams, prefix = ""): ListPageRequest {
  const raw = first(searchParams[`${prefix}page`]) ?? "";
  const parsed = /^\d+$/.test(raw) ? Number(raw) : 1;
  const page = Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
  const q = (first(searchParams[`${prefix}q`]) ?? "").trim().slice(0, maxSearchLength);
  return { prefix, page, q, ...rangeFor(page) };
}

export function lastPageFor(total: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function rangeLabel(total: number, page: number) {
  if (total === 0) return "0 records";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}–${end} of ${total} ${total === 1 ? "record" : "records"}`;
}

/** Clamps the requested page to the pages that exist for `total` rows. */
export function finishListPage(total: number, requestedPage: number): ListPageState {
  const lastPage = lastPageFor(total);
  const page = Math.min(Math.max(1, requestedPage), lastPage);
  return { page, lastPage, total, rangeLabel: rangeLabel(total, page) };
}

/**
 * Builds a link that changes some params and keeps the rest. Page 1 and empty values are left out.
 * Changing a list's search text drops that list's page, so a new search starts on page 1.
 */
export function listHref(pathname: string, searchParams: SearchParams, changes: Record<string, string | number | null>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const single = first(value);
    if (single !== undefined && single !== "") next.set(key, single);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (key.endsWith("q")) next.delete(`${key.slice(0, -1)}page`);
    if (value === null || value === "" || (key.endsWith("page") && Number(value) === 1)) next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** In-memory paging and search with the same rules, for demo mode and small already-loaded lists. */
export function pageRows<Row>(rows: readonly Row[], request: ListPageRequest, textOf: (row: Row) => string) {
  const needle = request.q.toLowerCase();
  const matching = needle ? rows.filter((row) => textOf(row).toLowerCase().includes(needle)) : [...rows];
  const state = finishListPage(matching.length, request.page);
  const { from } = rangeFor(state.page);
  return { rows: matching.slice(from, from + pageSize), ...state };
}

/**
 * Runs a counted slice query and, when the requested page is past the end (rows were removed, or
 * the URL was edited), reads the last page instead (research R3).
 */
export async function fetchListPage<Row>(request: ListPageRequest, run: (from: number, to: number) => PromiseLike<{ data: Row[] | null; count: number | null }>) {
  const firstTry = await run(request.from, request.to);
  const total = firstTry.count ?? 0;
  const state = finishListPage(total, request.page);
  if (state.page === request.page) return { rows: firstTry.data ?? [], ...state };
  const range = rangeFor(state.page);
  const retry = await run(range.from, range.to);
  return { rows: retry.data ?? [], ...finishListPage(retry.count ?? total, state.page) };
}
