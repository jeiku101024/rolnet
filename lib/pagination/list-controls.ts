import { addDays, fleetTimeZone, fleetToday } from "@/lib/dates/fleet-date";
import type { SearchParams } from "@/lib/pagination/list-page";

/**
 * Sort and filter controls for the main lists (feature 006, User Story 8). A list declares its
 * sorts and filters once (lib/pagination/list-control-specs.ts); this module validates the URL
 * against that declaration, applies it to a Supabase query, and does the same in memory for demo
 * mode, so both paths follow one set of rules.
 */

export interface SortOption { value: string; label: string; column: string; ascending: boolean; then?: { column: string; ascending: boolean }[] }
export interface FilterOption { value: string; label: string }

/** `eq`: one column equals the chosen value (`values` maps a URL value to a column value, e.g. "active" → true). */
export interface EqFilter { kind: "eq"; param: string; label: string; column: string; options: FilterOption[]; values?: Record<string, string | boolean>; ownerOnly?: boolean }
/** `presence`: each option checks that its column is filled in (or empty). */
export interface PresenceFilter { kind: "presence"; param: string; label: string; options: (FilterOption & { column: string; present: boolean })[]; ownerOnly?: boolean }
/** `range`: a from/to date pair on a date (or, with `timestamp`, a timestamp) column. Params are `from` and `to`. */
export interface RangeFilter { kind: "range"; label: string; column: string; timestamp?: boolean; ownerOnly?: boolean }
/** `bucket`: expired (before today), soon (today to +30 days), due (up to +30 days), later (after +30 days). */
export interface BucketFilter { kind: "bucket"; param: string; label: string; column: string; options: FilterOption[]; ownerOnly?: boolean }
/** `page`: shown and validated here, applied by the page itself (it needs ids from an RPC). */
export interface PageFilter { kind: "page"; param: string; label: string; options: FilterOption[]; ownerOnly?: boolean }

export type FilterDef = EqFilter | PresenceFilter | RangeFilter | BucketFilter | PageFilter;
export interface ControlsSpec { sorts: SortOption[]; filters: FilterDef[] }

export const soonDays = 30;
export const bucketLabels: FilterOption[] = [
  { value: "expired", label: "Expired" },
  { value: "soon", label: "Within 30 days" },
  { value: "due", label: "Expired or within 30 days" },
  { value: "later", label: "Later" },
];

export interface ActiveFilter { def: FilterDef; value: string; from?: string; to?: string }
export interface ParsedControls {
  /** The spec as shown to this user: owner-only filters removed for staff, dynamic options filled in. */
  spec: ControlsSpec;
  sort: SortOption;
  sortIsDefault: boolean;
  active: ActiveFilter[];
  /** Current value of every control, keyed by URL param (`from`/`to` for a range). */
  values: Record<string, string>;
  /** Number of filters on (a date range counts once). */
  count: number;
  today: string;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function first(value: string | string[] | undefined) { return (Array.isArray(value) ? value[0] : value) ?? ""; }
export function isRealDate(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Adds runtime options (units, drivers, categories) to `eq` filters and drops owner-only ones for staff. */
export function prepareSpec(spec: ControlsSpec, { isOwner = true, options = {} }: { isOwner?: boolean; options?: Record<string, FilterOption[]> } = {}): ControlsSpec {
  return {
    sorts: spec.sorts,
    filters: spec.filters
      .filter((def) => isOwner || !def.ownerOnly)
      .map((def) => (def.kind === "eq" && options[def.param] ? { ...def, options: options[def.param] } : def)),
  };
}

/** Reads `sort` and the filter params, keeping only values the list offers (anything else is ignored). */
export function parseControls(searchParams: SearchParams, spec: ControlsSpec, today = fleetToday()): ParsedControls {
  const sortValue = first(searchParams.sort);
  const sort = spec.sorts.find((option) => option.value === sortValue) ?? spec.sorts[0];
  const active: ActiveFilter[] = [];
  const values: Record<string, string> = {};
  for (const def of spec.filters) {
    if (def.kind === "range") {
      const from = first(searchParams.from);
      const to = first(searchParams.to);
      const filter: ActiveFilter = { def, value: "range" };
      if (isRealDate(from)) { filter.from = from; values.from = from; }
      if (isRealDate(to)) { filter.to = to; values.to = to; }
      if (filter.from || filter.to) active.push(filter);
      continue;
    }
    const value = first(searchParams[def.param]);
    if (def.options.some((option) => option.value === value)) { active.push({ def, value }); values[def.param] = value; }
  }
  return { spec, sort, sortIsDefault: sort === spec.sorts[0], active, values, count: active.length, today };
}

/** What the toolbar needs to draw a list's sort and filter controls (plain data, safe to pass to the client). */
export interface ListControlsView { spec: ControlsSpec; sort: string; values: Record<string, string>; count: number; today: string }

export function controlsView(parsed: ParsedControls): ListControlsView {
  return { spec: parsed.spec, sort: parsed.sort.value, values: parsed.values, count: parsed.count, today: parsed.today };
}

export function activeValue(parsed: ParsedControls, param: string) {
  return parsed.active.find((filter) => filter.def.kind !== "range" && "param" in filter.def && filter.def.param === param)?.value;
}

/** Offset of the fleet time zone from UTC at a moment, in minutes. */
function zoneOffsetMinutes(at: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The UTC instant at which a fleet calendar day starts (00:00 in the fleet time zone). */
export function fleetDayStart(isoDate: string, timeZone = fleetTimeZone()) {
  const midnightUtc = new Date(`${isoDate}T00:00:00Z`);
  return new Date(midnightUtc.getTime() - zoneOffsetMinutes(midnightUtc, timeZone) * 60_000).toISOString();
}

function bucketBounds(value: string, today: string) {
  const limit = addDays(today, soonDays);
  if (value === "expired") return { lt: today };
  if (value === "soon") return { gte: today, lte: limit };
  if (value === "due") return { lte: limit };
  return { gt: limit };
}

/** The subset of a Supabase query builder these controls use. */
interface ControlQuery {
  eq(column: string, value: unknown): ControlQuery;
  is(column: string, value: null): ControlQuery;
  not(column: string, operator: string, value: unknown): ControlQuery;
  gt(column: string, value: unknown): ControlQuery;
  gte(column: string, value: unknown): ControlQuery;
  lt(column: string, value: unknown): ControlQuery;
  lte(column: string, value: unknown): ControlQuery;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): ControlQuery;
}

/** Adds the active filters (except `page` ones) to a query. Call before `.or()` search and paging. */
export function applyFilters<T>(query: T, parsed: ParsedControls): T {
  let q = query as unknown as ControlQuery;
  for (const filter of parsed.active) {
    const def = filter.def;
    if (def.kind === "eq") q = q.eq(def.column, def.values?.[filter.value] ?? filter.value);
    else if (def.kind === "presence") { const option = def.options.find((item) => item.value === filter.value)!; q = option.present ? q.not(option.column, "is", null) : q.is(option.column, null); }
    else if (def.kind === "range") {
      if (filter.from) q = q.gte(def.column, def.timestamp ? fleetDayStart(filter.from) : filter.from);
      if (filter.to) q = def.timestamp ? q.lt(def.column, fleetDayStart(addDays(filter.to, 1))) : q.lte(def.column, filter.to);
    } else if (def.kind === "bucket") {
      const bounds = bucketBounds(filter.value, parsed.today);
      if (bounds.lt) q = q.lt(def.column, bounds.lt);
      if (bounds.gte) q = q.gte(def.column, bounds.gte);
      if (bounds.lte) q = q.lte(def.column, bounds.lte);
      if (bounds.gt) q = q.gt(def.column, bounds.gt);
    }
  }
  return q as unknown as T;
}

/** Adds the chosen sort (and its tie-breakers) to a query. */
export function applySort<T>(query: T, parsed: ParsedControls): T {
  let q = query as unknown as ControlQuery;
  for (const order of [{ column: parsed.sort.column, ascending: parsed.sort.ascending }, ...(parsed.sort.then ?? [])]) q = q.order(order.column, { ascending: order.ascending, nullsFirst: false });
  return q as unknown as T;
}

type Row = Record<string, unknown>;
const dayOf = (value: unknown, timestamp?: boolean) => (typeof value === "string" ? (timestamp ? fleetToday(new Date(value)) : value.slice(0, 10)) : "");

/** Demo mode: the same filters as `applyFilters`, in memory. */
export function matchesControls(row: Row, parsed: ParsedControls) {
  return parsed.active.every((filter) => {
    const def = filter.def;
    if (def.kind === "eq") return row[def.column] === (def.values?.[filter.value] ?? filter.value);
    if (def.kind === "presence") { const option = def.options.find((item) => item.value === filter.value)!; const filled = row[option.column] !== null && row[option.column] !== undefined && row[option.column] !== ""; return option.present ? filled : !filled; }
    if (def.kind === "range") { const day = dayOf(row[def.column], def.timestamp); return Boolean(day) && (!filter.from || day >= filter.from) && (!filter.to || day <= filter.to); }
    if (def.kind === "bucket") {
      const day = dayOf(row[def.column]);
      const bounds = bucketBounds(filter.value, parsed.today);
      return Boolean(day) && (!bounds.lt || day < bounds.lt) && (!bounds.gte || day >= bounds.gte) && (!bounds.lte || day <= bounds.lte) && (!bounds.gt || day > bounds.gt);
    }
    return true;
  });
}

function compare(a: unknown, b: unknown) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/** Demo mode: the same order as `applySort`, in memory (empty values last). */
export function sortRows<R extends Row>(rows: R[], parsed: ParsedControls): R[] {
  const orders = [{ column: parsed.sort.column, ascending: parsed.sort.ascending }, ...(parsed.sort.then ?? [])];
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const empty = (value: unknown) => value === null || value === undefined;
      if (empty(a[order.column]) !== empty(b[order.column])) return empty(a[order.column]) ? 1 : -1;
      const result = compare(a[order.column], b[order.column]);
      if (result) return order.ascending ? result : -result;
    }
    return 0;
  });
}

/** Demo mode in one call: filter, then sort. */
export function controlRows<R extends Row>(rows: R[], parsed: ParsedControls): R[] {
  return sortRows(rows.filter((row) => matchesControls(row, parsed)), parsed);
}
