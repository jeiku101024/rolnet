import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoMode, demoDrivers } from "@/lib/demo/mode";
import { fleetToday } from "@/lib/dates/fleet-date";
import { applyFilters, applySort, controlRows, controlsView, parseControls, prepareSpec, type ListControlsView, type ParsedControls } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";
import type { SearchParams } from "@/lib/pagination/list-page";
import { buildLoans, fundSummary, ledgerRows, monthlyFlows, openLoans, participantSummaries, rankingFor } from "@/lib/sinking-fund/aggregate";
import { demoSfData, demoSfSettings } from "@/lib/sinking-fund/demo-data";
import { periodRange } from "@/lib/sinking-fund/rankings";
import type { SfPageParams } from "@/lib/sinking-fund/url-state";
import type { SfDistribution, SfFundSummary, SfLedgerRow, SfLoan, SfMonthlyFlow, SfParticipantSummary, SfPrefill, SfRankingRow } from "@/lib/sinking-fund/types";

export type SfDriverOption = { id: string; full_name: string };

export type SfDetail = {
  participant: SfParticipantSummary;
  loans: SfLoan[];
  history: SfLedgerRow[];
  historyTotal: number;
};

export type SfPageData = {
  /** Active participants with their figures (cards, dialogs, ranking names). */
  participants: SfParticipantSummary[];
  /** Every open or overdue loan, oldest first, for the Payment form and menus. */
  openLoans: SfLoan[];
  summary: SfFundSummary;
  prefill: SfPrefill;
  distributions: SfDistribution[];
  drivers: SfDriverOption[];
  today: string;
  controls: ListControlsView;
  ledger?: { rows: SfLedgerRow[]; total: number };
  ranking?: SfRankingRow[];
  period?: ReturnType<typeof periodRange>;
  flows?: SfMonthlyFlow[];
  detail?: SfDetail | null;
};

const one = <T,>(rows: T[] | null) => (rows ?? [])[0];

/** Removes characters that would change the meaning of a PostgREST `or(...)` filter, then wraps the text for ilike. */
function searchPattern(text: string) {
  return `%${text.replace(/[%_,()*\\]/g, " ").trim()}%`;
}

type LedgerQuery = {
  or(filter: string): LedgerQuery;
  eq(column: string, value: unknown): LedgerQuery;
  range(from: number, to: number): PromiseLike<{ data: SfLedgerRow[] | null; count: number | null }>;
};

async function loadFromDatabase(params: SfPageParams, controls: ParsedControls): Promise<Omit<SfPageData, "controls" | "today">> {
  const supabase = await createSupabaseServerClient();
  const [summaries, summaryResult, loansResult, settings, distributions, linked, driverRows] = await Promise.all([
    supabase.rpc("sf_participant_summaries", {}),
    supabase.rpc("sf_fund_summary", { p_from: controls.active.find((f) => f.def.kind === "range")?.from ?? null, p_to: controls.active.find((f) => f.def.kind === "range")?.to ?? null }),
    supabase.from("sf_loans_v").select("*").eq("status", "open").order("loan_date", { ascending: true }).order("id", { ascending: true }),
    supabase.from("sf_settings").select("default_interest_prefill").maybeSingle(),
    supabase.rpc("sf_distribution_history", {}),
    supabase.from("sf_participants").select("driver_id").not("driver_id", "is", null).is("deleted_at", null),
    supabase.from("drivers").select("id, full_name").is("deleted_at", null).order("full_name"),
  ]);
  const participants = (summaries.data ?? []) as SfParticipantSummary[];
  const linkedIds = new Set((linked.data ?? []).map((row) => row.driver_id));
  const base = {
    participants,
    openLoans: (loansResult.data ?? []) as unknown as SfLoan[],
    summary: one(summaryResult.data as SfFundSummary[] | null) ?? emptySummary,
    prefill: (settings.data?.default_interest_prefill ?? "first") as SfPrefill,
    distributions: (distributions.data ?? []) as SfDistribution[],
    drivers: (driverRows.data ?? []).filter((driver) => !linkedIds.has(driver.id)) as SfDriverOption[],
  };

  const extra: Partial<SfPageData> = {};
  if (params.view === "transactions") {
    let query = supabase.from("sf_ledger_v").select("*", { count: "exact" }) as unknown as LedgerQuery;
    query = applyFilters(query, controls);
    if (params.q) { const pattern = searchPattern(params.q); query = query.or(`participant_name.ilike.${pattern},notes.ilike.${pattern}`); }
    const result = await (applySort(query, controls) as LedgerQuery).range(0, params.n - 1);
    extra.ledger = { rows: result.data ?? [], total: result.count ?? 0 };
  } else if (params.view === "top") {
    const period = periodRange(params.period, params.at, fleetToday());
    const ranking = await supabase.rpc("sf_ranking", { p_rank_by: params.rank, p_start: period.start, p_end: period.end });
    extra.period = period;
    extra.ranking = (ranking.data ?? []) as SfRankingRow[];
  } else {
    const flows = await supabase.rpc("sf_monthly_flows", { p_months: 6 });
    extra.flows = (flows.data ?? []) as SfMonthlyFlow[];
  }

  if (params.detail) {
    const participant = participants.find((item) => item.participant_id === params.detail);
    if (participant) {
      const [loans, history] = await Promise.all([
        supabase.from("sf_loans_v").select("*").eq("participant_id", participant.participant_id).order("loan_date", { ascending: false }),
        supabase.from("sf_ledger_v").select("*", { count: "exact" }).eq("participant_id", participant.participant_id).order("tx_date", { ascending: false }).order("created_at", { ascending: false }).range(0, params.hn - 1),
      ]);
      extra.detail = { participant, loans: (loans.data ?? []) as unknown as SfLoan[], history: (history.data ?? []) as unknown as SfLedgerRow[], historyTotal: history.count ?? 0 };
    } else extra.detail = null;
  }
  return { ...base, ...extra };
}

const emptySummary: SfFundSummary = {
  total_savings_centavos: 0, loans_outstanding_centavos: 0, open_loan_count: 0, balance_to_collect_centavos: 0, payments_received_centavos: 0,
  interest_collected_centavos: 0, interest_distributed_centavos: 0, interest_available_centavos: 0, interest_expected_centavos: 0, participant_count: 0,
};

function loadFromDemo(params: SfPageParams, controls: ParsedControls, today: string): Omit<SfPageData, "controls" | "today"> {
  const data = demoSfData;
  const participants = participantSummaries(data, today);
  const range = controls.active.find((filter) => filter.def.kind === "range");
  const linked = new Set(data.participants.map((participant) => participant.driver_id).filter(Boolean));
  const base = {
    participants,
    openLoans: openLoans(buildLoans(data, today)).sort((a, b) => a.loan_date.localeCompare(b.loan_date)),
    summary: fundSummary(data, today, range?.from, range?.to),
    prefill: demoSfSettings.default_interest_prefill as SfPrefill,
    distributions: [...data.distributions].sort((a, b) => b.dist_date.localeCompare(a.dist_date)),
    drivers: demoDrivers.filter((driver) => !linked.has(driver.id)).map((driver) => ({ id: driver.id, full_name: driver.full_name })),
  };
  const extra: Partial<SfPageData> = {};
  if (params.view === "transactions") {
    const needle = params.q.toLowerCase();
    const matching = controlRows(ledgerRows(data, today) as unknown as Record<string, unknown>[], controls) as unknown as SfLedgerRow[];
    const filtered = matching.filter((row) => !needle || `${row.participant_name} ${row.notes ?? ""}`.toLowerCase().includes(needle));
    extra.ledger = { rows: filtered.slice(0, params.n), total: filtered.length };
  } else if (params.view === "top") {
    const period = periodRange(params.period, params.at, today);
    extra.period = period;
    extra.ranking = rankingFor(data, params.rank, period.start, period.end);
  } else {
    extra.flows = monthlyFlows(data, 6, today);
  }
  if (params.detail) {
    const participant = participants.find((item) => item.participant_id === params.detail);
    if (participant) {
      const history = ledgerRows(data, today).filter((row) => row.participant_id === participant.participant_id).sort((a, b) => b.tx_date.localeCompare(a.tx_date) || b.created_at.localeCompare(a.created_at));
      extra.detail = { participant, loans: buildLoans(data, today).filter((loan) => loan.participant_id === participant.participant_id), history: history.slice(0, params.hn), historyTotal: history.length };
    } else extra.detail = null;
  }
  return { ...base, ...extra };
}

/** Everything /sinking-fund needs for the active view (plus the figures every view and dialog share). */
export async function loadSinkingFund(params: SfPageParams, searchParams: SearchParams): Promise<SfPageData> {
  const today = fleetToday();
  // Participant filter options come from the people on the page, so load the shared pieces first.
  const optionSource = demoMode ? participantSummaries(demoSfData, today) : null;
  let controls = parseControls(searchParams, prepareSpec(listControlSpecs.sinkingFund, { options: { participant: (optionSource ?? []).map((item) => ({ value: item.participant_id, label: item.name })) } }), today);
  if (demoMode) return { ...loadFromDemo(params, controls, today), controls: controlsView(controls), today };

  // A first pass reads the participants so the Participant filter can offer them, then the real pass runs.
  const supabase = await createSupabaseServerClient();
  const { data: names } = await supabase.from("sf_participants").select("id, name").is("archived_at", null).is("deleted_at", null).order("name");
  controls = parseControls(searchParams, prepareSpec(listControlSpecs.sinkingFund, { options: { participant: (names ?? []).map((item) => ({ value: item.id, label: item.name })) } }), today);
  return { ...(await loadFromDatabase(params, controls)), controls: controlsView(controls), today };
}
