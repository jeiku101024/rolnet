import type { SearchParams } from "@/lib/pagination/list-page";
import { isRealDate } from "@/lib/pagination/list-controls";

// Feature 010 (FR-001, FR-009, FR-056, research R10): which Units view the address asks for. The
// owner lands on List view; staff always get the Daily assignment view. Any real date is allowed,
// including future dates for planning.

export type UnitsView = "list" | "daily";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseUnitsView(params: SearchParams, today: string, isOwner: boolean): { view: UnitsView; date: string } {
  const view: UnitsView = !isOwner || first(params.view) === "daily" ? "daily" : "list";
  const date = first(params.date);
  return { view, date: date && isRealDate(date) ? date : today };
}

/** The Daily assignment view, on a date or (without one) on today. */
export function unitsDailyHref(date?: string) {
  return date ? `/units?view=daily&date=${date}` : "/units?view=daily";
}

export function unitsListHref() {
  return "/units";
}
