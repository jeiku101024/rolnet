import type { SearchParams } from "@/lib/pagination/list-page";
import type { RankPeriod } from "@/lib/sinking-fund/rankings";
import type { SfView } from "@/lib/sinking-fund/types";

/** Query parameters of /sinking-fund (contracts/page-and-urls.md). Unknown values fall back to the defaults. */

export const sfViews: readonly SfView[] = ["transactions", "top", "participants"];
export const participantSorts = ["savings", "name", "balance"] as const;
export type ParticipantSort = (typeof participantSorts)[number];
export type RankBy = "savings" | "deposits";

export const loadMoreStep = 25;
export const historyStep = 10;
const maxRows = 1000;

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function stepped(raw: string, step: number) {
  const value = /^\d+$/.test(raw) ? Number(raw) : step;
  if (!Number.isSafeInteger(value) || value < step) return step;
  return Math.min(Math.ceil(value / step) * step, maxRows);
}

export type SfPageParams = {
  view: SfView;
  q: string;
  /** How many Transactions rows to show (25, 50, 75...). */
  n: number;
  rank: RankBy;
  period: RankPeriod;
  at: string | undefined;
  psort: ParticipantSort;
  /** The participant whose detail sheet is open. */
  detail: string | undefined;
  /** How many history rows the detail sheet shows (10, 20...). */
  hn: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSfParams(searchParams: SearchParams): SfPageParams {
  const view = first(searchParams.view);
  const rank = first(searchParams.rank);
  const period = first(searchParams.period);
  const psort = first(searchParams.psort);
  const detail = first(searchParams.detail);
  const at = first(searchParams.at);
  return {
    view: (sfViews as readonly string[]).includes(view) ? (view as SfView) : "transactions",
    q: first(searchParams.q).trim().slice(0, 100),
    n: stepped(first(searchParams.n), loadMoreStep),
    rank: rank === "deposits" ? "deposits" : "savings",
    period: period === "month" || period === "week" ? period : "all",
    at: at || undefined,
    psort: (participantSorts as readonly string[]).includes(psort) ? (psort as ParticipantSort) : "savings",
    detail: uuidPattern.test(detail) ? detail : undefined,
    hn: stepped(first(searchParams.hn), historyStep),
  };
}

/** Params that belong to one view only; switching views drops the others so links stay tidy. */
const viewParams: Record<SfView, string[]> = {
  transactions: ["q", "type", "participant", "from", "to", "loan_status", "sort", "n"],
  top: ["rank", "period", "at"],
  participants: ["q", "psort"],
};

/** The URL for a view, keeping only that view's parameters (and an open detail sheet). */
export function viewHref(pathname: string, current: SearchParams, view: SfView) {
  const next = new URLSearchParams();
  if (view !== "transactions") next.set("view", view);
  for (const key of viewParams[view]) {
    const value = first(current[key]);
    if (value) next.set(key, value);
  }
  const detail = first(current.detail);
  if (detail) next.set("detail", detail);
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
