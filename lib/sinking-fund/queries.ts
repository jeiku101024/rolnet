import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoMode, demoDrivers } from "@/lib/demo/mode";
import { fleetToday } from "@/lib/dates/fleet-date";
import { applyFilters, applySort, controlRows, controlsView, parseControls, prepareSpec, type ListControlsView, type ParsedControls } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";
import { fetchListPage, finishListPage, parseListPage, rangeFor, pageSize, type ListPageState, type SearchParams } from "@/lib/pagination/list-page";
import { buildLoans, distributionDetail, distributionTotals, fundSummary, ledgerRows, monthlyFlows, openLoans, participantSummaries, rankingFor, standingsFor } from "@/lib/sinking-fund/aggregate";
import { demoSfData, demoSfSettings } from "@/lib/sinking-fund/demo-data";
import { periodRange } from "@/lib/sinking-fund/rankings";
import { yearChoices } from "@/lib/reports/download-years";
import type { SfPageParams } from "@/lib/sinking-fund/url-state";
import type { SfDistribution, SfDistributionDetail, SfDistributionRow, SfFundSummary, SfLedgerRow, SfLoan, SfLoanPayment, SfMonthlyFlow, SfParticipantSummary, SfPrefill, SfRankingRow, SfStandingRow } from "@/lib/sinking-fund/types";

export type SfDriverOption = { id: string; full_name: string };

/** One page of the ledger (feature 021): at most ten rows plus the paging state the Pagination control draws. */
export type SfLedgerPage = ListPageState & { rows: SfLedgerRow[] };

/** What a participant's own page needs: the shared page data (for the dialogs), their loans, and one page of their history. */
export type SfParticipantPageData = {
  shared: SfPageData;
  participant: SfParticipantSummary;
  loans: SfLoan[];
  /** Every non-voided payment against these loans, oldest first (feature 022). */
  payments: SfLoanPayment[];
  history: SfLedgerPage;
  controls: ListControlsView;
  q: string;
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
  ledger?: SfLedgerPage;
  ranking?: SfRankingRow[];
  period?: ReturnType<typeof periodRange>;
  flows?: SfMonthlyFlow[];
  /** Years offered by the owner's monthly standings download (feature 019). Empty for staff. */
  standingsYears: number[];
};

/** The figures behind the monthly standings workbook, as of `asOf` (owner only: the database function checks the caller). */
export async function loadStandings(asOf: string): Promise<SfStandingRow[]> {
  if (demoMode) return standingsFor(demoSfData, asOf);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("sf_standings", { p_as_of: asOf });
  if (error) throw error;
  return (data ?? []) as SfStandingRow[];
}

/** Years the standings download offers: from the earliest ledger year (or ten years back) to this year. Owner only. */
async function loadStandingsYears(isOwner: boolean): Promise<number[]> {
  if (!isOwner) return [];
  const earliest = demoMode
    ? demoSfData.transactions.map((row) => row.tx_date).sort()[0] ?? null
    : await (await createSupabaseServerClient()).from("sf_transactions").select("tx_date").order("tx_date").limit(1).maybeSingle().then(({ data }) => (data?.tx_date as string | undefined) ?? null);
  return yearChoices(earliest);
}

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

type SfBase = Omit<SfPageData, "controls" | "today" | "standingsYears" | "ledger" | "ranking" | "period" | "flows">;

/** The pieces every Sinking fund screen and dialog share, read from the database. */
async function baseFromDatabase(isOwner: boolean, range: { from?: string; to?: string } = {}): Promise<SfBase> {
  const supabase = await createSupabaseServerClient();
  const [summaries, summaryResult, loansResult, settings, distributions, linked, driverRows] = await Promise.all([
    supabase.rpc("sf_participant_summaries", {}),
    supabase.rpc("sf_fund_summary", { p_from: range.from ?? null, p_to: range.to ?? null }),
    supabase.from("sf_loans_v").select("*").eq("status", "open").order("loan_date", { ascending: true }).order("id", { ascending: true }),
    supabase.from("sf_settings").select("default_interest_prefill").maybeSingle(),
    // The distribution history lists every participant's ended savings: owner only (it raises for anyone else).
    isOwner ? supabase.rpc("sf_distribution_history", {}) : Promise.resolve({ data: [] as SfDistribution[] }),
    supabase.from("sf_participants").select("driver_id").not("driver_id", "is", null).is("deleted_at", null),
    supabase.from("drivers").select("id, full_name").is("deleted_at", null).order("full_name"),
  ]);
  const participants = (summaries.data ?? []) as SfParticipantSummary[];
  const linkedIds = new Set((linked.data ?? []).map((row) => row.driver_id));
  return {
    participants,
    openLoans: (loansResult.data ?? []) as unknown as SfLoan[],
    summary: one(summaryResult.data as SfFundSummary[] | null) ?? emptySummary,
    prefill: (settings.data?.default_interest_prefill ?? "first") as SfPrefill,
    distributions: (distributions.data ?? []) as SfDistribution[],
    drivers: (driverRows.data ?? []).filter((driver) => !linkedIds.has(driver.id)) as SfDriverOption[],
  };
}

async function loadFromDatabase(params: SfPageParams, controls: ParsedControls, searchParams: SearchParams, isOwner: boolean): Promise<Omit<SfPageData, "controls" | "today" | "standingsYears">> {
  const supabase = await createSupabaseServerClient();
  const range = controls.active.find((f) => f.def.kind === "range");
  const base = await baseFromDatabase(isOwner, { from: range?.from, to: range?.to });
  const extra: Partial<SfPageData> = {};
  if (params.view === "transactions") {
    let query = supabase.from("sf_ledger_v").select("*", { count: "exact" }) as unknown as LedgerQuery;
    query = applyFilters(query, controls);
    if (params.q) { const pattern = searchPattern(params.q); query = query.or(`participant_name.ilike.${pattern},notes.ilike.${pattern}`); }
    const sorted = applySort(query, controls) as LedgerQuery;
    extra.ledger = await fetchListPage(parseListPage(searchParams), (from, to) => sorted.range(from, to));
  } else if (params.view === "top") {
    const period = periodRange(params.period, params.at, fleetToday());
    const ranking = await supabase.rpc("sf_ranking", { p_rank_by: params.rank, p_start: period.start, p_end: period.end });
    extra.period = period;
    extra.ranking = (ranking.data ?? []) as SfRankingRow[];
  } else {
    const flows = await supabase.rpc("sf_monthly_flows", { p_months: 6 });
    extra.flows = (flows.data ?? []) as SfMonthlyFlow[];
  }

  return { ...base, ...extra };
}

const emptySummary: SfFundSummary = {
  total_savings_centavos: 0, loans_outstanding_centavos: 0, open_loan_count: 0, balance_to_collect_centavos: 0, payments_received_centavos: 0,
  interest_collected_centavos: 0, interest_distributed_centavos: 0, interest_available_centavos: 0, interest_expected_centavos: 0, participant_count: 0, cycle_start: null,
};

function baseFromDemo(today: string, isOwner: boolean, range?: { from?: string; to?: string }): SfBase {
  const data = demoSfData;
  const participants = participantSummaries(data, today);
  const linked = new Set(data.participants.map((participant) => participant.driver_id).filter(Boolean));
  return {
    participants,
    openLoans: openLoans(buildLoans(data, today)).sort((a, b) => a.loan_date.localeCompare(b.loan_date)),
    summary: fundSummary(data, today, range?.from, range?.to),
    prefill: demoSfSettings.default_interest_prefill as SfPrefill,
    distributions: isOwner ? [...data.distributions].sort((a, b) => b.dist_date.localeCompare(a.dist_date)) : [],
    drivers: demoDrivers.filter((driver) => !linked.has(driver.id)).map((driver) => ({ id: driver.id, full_name: driver.full_name })),
  };
}

function loadFromDemo(params: SfPageParams, controls: ParsedControls, searchParams: SearchParams, today: string, isOwner: boolean): Omit<SfPageData, "controls" | "today" | "standingsYears"> {
  const data = demoSfData;
  const range = controls.active.find((filter) => filter.def.kind === "range");
  const base = baseFromDemo(today, isOwner, range);
  const extra: Partial<SfPageData> = {};
  if (params.view === "transactions") {
    const needle = params.q.toLowerCase();
    const matching = controlRows(ledgerRows(data, today) as unknown as Record<string, unknown>[], controls) as unknown as SfLedgerRow[];
    const filtered = matching.filter((row) => !needle || `${row.participant_name} ${row.notes ?? ""}`.toLowerCase().includes(needle));
    extra.ledger = pageDemoLedger(filtered, searchParams);
  } else if (params.view === "top") {
    const period = periodRange(params.period, params.at, today);
    extra.period = period;
    extra.ranking = rankingFor(data, params.rank, period.start, period.end);
  } else {
    extra.flows = monthlyFlows(data, 6, today);
  }
  return { ...base, ...extra };
}

/** Everything /sinking-fund needs for the active view (plus the figures every view and dialog share). */
export async function loadSinkingFund(params: SfPageParams, searchParams: SearchParams, isOwner: boolean): Promise<SfPageData> {
  const today = fleetToday();
  // Participant filter options come from the people on the page, so load the shared pieces first.
  const optionSource = demoMode ? participantSummaries(demoSfData, today) : null;
  let controls = parseControls(searchParams, prepareSpec(listControlSpecs.sinkingFund, { options: { participant: (optionSource ?? []).map((item) => ({ value: item.participant_id, label: item.name })) } }), today);
  const standingsYears = await loadStandingsYears(isOwner);
  if (demoMode) return { ...loadFromDemo(params, controls, searchParams, today, isOwner), controls: controlsView(controls), today, standingsYears };

  // A first pass reads the participants so the Participant filter can offer them, then the real pass runs.
  const supabase = await createSupabaseServerClient();
  const { data: names } = await supabase.from("sf_participants").select("id, name").is("archived_at", null).is("deleted_at", null).order("name");
  controls = parseControls(searchParams, prepareSpec(listControlSpecs.sinkingFund, { options: { participant: (names ?? []).map((item) => ({ value: item.id, label: item.name })) } }), today);
  return { ...(await loadFromDatabase(params, controls, searchParams, isOwner)), controls: controlsView(controls), today, standingsYears };
}

/** Demo mode: the page of an already filtered and sorted ledger the address asks for (past the end shows the last page). */
function pageDemoLedger(rows: SfLedgerRow[], searchParams: SearchParams): SfLedgerPage {
  const state = finishListPage(rows.length, parseListPage(searchParams).page);
  const { from } = rangeFor(state.page);
  return { rows: rows.slice(from, from + pageSize), ...state };
}

const historySpec = () => ({ sorts: listControlSpecs.sinkingFund.sorts, filters: [] });

/**
 * One participant's own page (feature 021): the shared data the dialogs need, their loans, and one page of their history
 * with the main list's paging, sorting, and a notes search. Null when the participant is unknown, archived, or deleted.
 */
export async function loadParticipantPage(participantId: string, searchParams: SearchParams, isOwner: boolean): Promise<SfParticipantPageData | null> {
  const today = fleetToday();
  const request = parseListPage(searchParams);
  const controls = parseControls(searchParams, historySpec(), today);
  const view = controlsView(controls);
  const extras = { today, controls: view, standingsYears: [] as number[] };
  if (demoMode) {
    const base = baseFromDemo(today, isOwner);
    const participant = base.participants.find((item) => item.participant_id === participantId);
    if (!participant) return null;
    const needle = request.q.toLowerCase();
    const own = ledgerRows(demoSfData, today).filter((row) => row.participant_id === participantId && (!needle || (row.notes ?? "").toLowerCase().includes(needle)));
    const history = pageDemoLedger(controlRows(own as unknown as Record<string, unknown>[], controls) as unknown as SfLedgerRow[], searchParams);
    const loans = buildLoans(demoSfData, today).filter((loan) => loan.participant_id === participantId).sort((a, b) => b.loan_date.localeCompare(a.loan_date));
    const payments = demoSfData.transactions
      .filter((row) => row.type === "payment" && row.participant_id === participantId && !row.voided_at && row.loan_id)
      .sort((a, b) => a.tx_date.localeCompare(b.tx_date) || a.created_at.localeCompare(b.created_at))
      .map((row): SfLoanPayment => ({ id: row.id, loan_id: row.loan_id!, tx_date: row.tx_date, amount_centavos: row.amount_centavos, interest_part_centavos: row.interest_part_centavos ?? 0, principal_part_centavos: row.principal_part_centavos ?? 0 }));
    return { shared: { ...base, ...extras }, participant, loans, payments, history, controls: view, q: request.q };
  }
  const base = await baseFromDatabase(isOwner);
  const participant = base.participants.find((item) => item.participant_id === participantId);
  if (!participant) return null;
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("sf_ledger_v").select("*", { count: "exact" }).eq("participant_id", participantId) as unknown as LedgerQuery;
  if (request.q) query = query.or(`notes.ilike.${searchPattern(request.q)}`);
  const sorted = applySort(query, controls) as LedgerQuery;
  const [loans, paymentRows, history] = await Promise.all([
    supabase.from("sf_loans_v").select("*").eq("participant_id", participantId).order("loan_date", { ascending: false }),
    supabase.from("sf_ledger_v").select("id, loan_id, tx_date, amount_centavos, interest_part_centavos, principal_part_centavos").eq("participant_id", participantId).eq("type", "payment").is("voided_at", null).order("tx_date", { ascending: true }).order("created_at", { ascending: true }),
    fetchListPage(request, (from, to) => sorted.range(from, to)),
  ]);
  const payments = ((paymentRows.data ?? []) as unknown as Partial<SfLoanPayment>[]).filter((row): row is SfLoanPayment => Boolean(row.loan_id)).map((row) => ({ ...row, interest_part_centavos: row.interest_part_centavos ?? 0, principal_part_centavos: row.principal_part_centavos ?? 0 }));
  return { shared: { ...base, ...extras }, participant, loans: (loans.data ?? []) as unknown as SfLoan[], payments, history, controls: view, q: request.q };
}

/** One distribution's table (owner only: the caller checks the role; the database function checks it again). Null when not found. */
export async function loadDistributionDetail(id: string): Promise<SfDistributionDetail | null> {
  if (demoMode) return distributionDetail(demoSfData, id);
  const supabase = await createSupabaseServerClient();
  const [history, details] = await Promise.all([supabase.rpc("sf_distribution_history", {}), supabase.rpc("sf_distribution_details", { p_id: id })]);
  if (history.error) throw history.error;
  if (details.error) throw details.error;
  const distribution = ((history.data ?? []) as SfDistribution[]).find((item) => item.id === id);
  if (!distribution) return null;
  const rows = (details.data ?? []) as SfDistributionRow[];
  return { distribution, rows, totals: distributionTotals(rows) };
}
