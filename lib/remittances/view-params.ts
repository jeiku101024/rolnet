import type { SearchParams } from "@/lib/pagination/list-page";
import { isRealDate } from "@/lib/pagination/list-controls";

// Feature 008 (FR-001a, FR-002): which Remittances view the address asks for. Daily view (on today)
// is the default; List view is `?view=list`, or any address carrying a list-only parameter so old
// links such as the dashboard's `?balance=unpaid` keep opening the list.

export type RemittancesView = "daily" | "list";

const listOnlyParams = ["q", "page", "sort", "from", "to", "unit", "driver", "disposition", "balance"];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRemittancesView(params: SearchParams, today: string): { view: RemittancesView; date: string } {
  const view = first(params.view);
  const list = view === "list" || (view !== "daily" && listOnlyParams.some((param) => first(params[param])));
  const date = first(params.date);
  return { view: list ? "list" : "daily", date: date && isRealDate(date) && date <= today ? date : today };
}

export function dailyHref(date?: string) {
  return date ? `/remittances?date=${date}` : "/remittances";
}

export function listViewHref() {
  return "/remittances?view=list";
}
