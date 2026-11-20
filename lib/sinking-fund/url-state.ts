import type { SearchParams } from "@/lib/pagination/list-page";
import type { RankPeriod } from "@/lib/sinking-fund/rankings";
import type { SfView } from "@/lib/sinking-fund/types";

/** Query parameters of /sinking-fund (contracts/page-and-urls.md). Unknown values fall back to the defaults. */

export const sfViews: readonly SfView[] = ["transactions", "top", "participants"];
export const participantSorts = ["savings", "name", "balance"] as const;
export type ParticipantSort = (typeof participantSorts)[number];
export type RankBy = "savings" | "deposits";

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export type SfPageParams = {
  view: SfView;
  q: string;
  rank: RankBy;
  period: RankPeriod;
  at: string | undefined;
  psort: ParticipantSort;
  /** Legacy (feature 016) address of the participant pop-up. It now only redirects to the participant's page. */
  detail: string | undefined;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

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
    rank: rank === "deposits" ? "deposits" : "savings",
    period: period === "month" || period === "week" ? period : "all",
    at: at || undefined,
    psort: (participantSorts as readonly string[]).includes(psort) ? (psort as ParticipantSort) : "savings",
    detail: uuidPattern.test(detail) ? detail : undefined,
  };
}

/** Params that belong to one view only; switching views drops the others so links stay tidy. */
const viewParams: Record<SfView, string[]> = {
  transactions: ["q", "type", "participant", "from", "to", "loan_status", "sort"],
  top: ["rank", "period", "at"],
  participants: ["q", "psort"],
};

/** The URL for a view, keeping only that view's parameters. */
export function viewHref(pathname: string, current: SearchParams, view: SfView) {
  const next = new URLSearchParams();
  if (view !== "transactions") next.set("view", view);
  for (const key of viewParams[view]) {
    const value = first(current[key]);
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const participantsHome = "/sinking-fund?view=participants";

/**
 * Where a participant page's back control goes (feature 021). Only an address inside /sinking-fund is accepted, so the
 * `return` parameter can never send the owner somewhere else.
 */
export function safeReturn(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\/sinking-fund(?:[?#]|$)/.test(raw)) return participantsHome;
  return raw;
}

/** The link to a participant's own page. `fromQuery` is the query string (with or without "?") of the screen it was opened from. */
export function participantHref(id: string, fromQuery = "") {
  const query = fromQuery.replace(/^\?/, "");
  const params = new URLSearchParams();
  if (query) params.set("return", `/sinking-fund?${query}`);
  const tail = params.toString();
  return `/sinking-fund/participants/${id}${tail ? `?${tail}` : ""}`;
}
