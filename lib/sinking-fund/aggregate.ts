import { addDays } from "@/lib/dates/fleet-date";
import { isLive, loanState } from "@/lib/sinking-fund/rules";
import { fundAt, savingsAt, savingsDelta } from "@/lib/sinking-fund/ledger";
import type { SfDistribution, SfDistributionDetail, SfDistributionRow, SfFundSummary, SfLedgerRow, SfLoan, SfMonthlyFlow, SfParticipant, SfParticipantSummary, SfRankingRow, SfTransaction } from "@/lib/sinking-fund/types";

/**
 * Pure TypeScript twin of the SQL read model (views sf_loans_v and sf_ledger_v and the sf_* read functions).
 * Demo mode renders from these, and unit tests pin them to the same worked examples as pgTAP.
 */
export type SfData = {
  participants: SfParticipant[];
  transactions: SfTransaction[];
  distributions: SfDistribution[];
  /** The saved per-participant rows of each distribution (demo twin of sf_distribution_participants), by distribution id. */
  distributionRows?: Record<string, SfDistributionRow[]>;
};

/**
 * The cycle starts after the latest non-voided year-end close (a distribution without an equal per-participant
 * amount; older equal-share distributions never closed a year). Null before any close.
 */
export function cycleStart(data: Pick<SfData, "distributions">): string | null {
  const dates = data.distributions.filter((distribution) => !distribution.voided_at && distribution.per_participant_centavos === null).map((distribution) => distribution.dist_date).sort();
  return dates.at(-1) ?? null;
}

const active = (participant: SfParticipant) => !participant.archived_at;
const byDateThenCreated = (a: SfTransaction, b: SfTransaction) => a.tx_date.localeCompare(b.tx_date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

export function buildLoans(data: SfData, today: string): SfLoan[] {
  return data.transactions.filter((row) => isLive(row) && row.type === "loan").map((row) => loanState(row, data.transactions, today));
}

export function openLoans(loans: readonly SfLoan[]) {
  return loans.filter((loan) => loan.status === "open");
}

export function participantSummaries(data: SfData, today: string, asOf?: string): SfParticipantSummary[] {
  const loans = buildLoans(data, today);
  return data.participants.filter(active).map((participant) => {
    const rows = data.transactions.filter((row) => row.participant_id === participant.id);
    const live = rows.filter(isLive);
    const mine = openLoans(loans).filter((loan) => loan.participant_id === participant.id);
    return {
      participant_id: participant.id,
      name: participant.name,
      driver_id: participant.driver_id,
      savings_centavos: savingsAt(rows, asOf),
      loans_centavos: mine.reduce((sum, loan) => sum + loan.principal_centavos, 0),
      balance_to_pay_centavos: mine.reduce((sum, loan) => sum + loan.balance_centavos, 0),
      has_overdue: mine.some((loan) => loan.overdue),
      last_transaction_date: live.length ? live.map((row) => row.tx_date).sort().at(-1)! : null,
      interest_shares_centavos: live.filter((row) => row.type === "interest_share").reduce((sum, row) => sum + row.amount_centavos, 0),
      updated_at: participant.updated_at,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function fundSummary(data: SfData, today: string, from?: string, to?: string): SfFundSummary {
  const loans = openLoans(buildLoans(data, today));
  const live = data.transactions.filter(isLive);
  const cycle = cycleStart(data);
  const inCycle = (row: SfTransaction) => !cycle || row.tx_date > cycle;
  const collected = live.filter((row) => row.type === "payment" && inCycle(row)).reduce((sum, row) => sum + (row.interest_part_centavos ?? 0), 0);
  const distributed = data.distributions.filter((d) => !d.voided_at).reduce((sum, d) => sum + d.total_distributed_centavos, 0);
  return {
    total_savings_centavos: live.reduce((sum, row) => sum + savingsDelta(row), 0),
    loans_outstanding_centavos: loans.reduce((sum, loan) => sum + loan.principal_centavos, 0),
    open_loan_count: loans.length,
    balance_to_collect_centavos: loans.reduce((sum, loan) => sum + loan.balance_centavos, 0),
    payments_received_centavos: live.filter((row) => row.type === "payment" && inCycle(row) && (!from || row.tx_date >= from) && (!to || row.tx_date <= to)).reduce((sum, row) => sum + row.amount_centavos, 0),
    interest_collected_centavos: collected,
    interest_distributed_centavos: distributed,
    interest_available_centavos: fundAt(data.transactions, data.distributions),
    interest_expected_centavos: loans.reduce((sum, loan) => sum + loan.unpaid_interest_centavos, 0),
    participant_count: data.participants.filter(active).length,
    cycle_start: cycle,
  };
}

/** Ranking amounts for active participants: savings at the end of `end`, or deposits dated start..end. */
export function rankingFor(data: SfData, by: "savings" | "deposits", startDate: string | null, end: string | null): SfRankingRow[] {
  // Deposits count the current cycle unless a period was chosen (the first day after the cycle start).
  const cycle = cycleStart(data);
  const start = startDate ?? (cycle ? addDays(cycle, 1) : null);
  return data.participants.filter(active).map((participant) => {
    const rows = data.transactions.filter((row) => row.participant_id === participant.id);
    const amount = by === "savings"
      ? savingsAt(rows, end ?? undefined)
      : rows.filter((row) => isLive(row) && row.type === "deposit" && (!start || row.tx_date >= start) && (!end || row.tx_date <= end)).reduce((sum, row) => sum + row.amount_centavos, 0);
    return { participant_id: participant.id, name: participant.name, driver_id: participant.driver_id, amount_centavos: amount };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** Deposits, loans, and payments per month for the last `months` months, oldest first (archived participants included). */
export function monthlyFlows(data: SfData, months: number, today: string): SfMonthlyFlow[] {
  const [year, month] = today.split("-").map(Number);
  const rows = data.transactions.filter(isLive);
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (months - 1 - index), 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const inMonth = rows.filter((row) => row.tx_date.startsWith(key));
    const sum = (type: SfTransaction["type"]) => inMonth.filter((row) => row.type === type).reduce((total, row) => total + row.amount_centavos, 0);
    return { month: `${key}-01`, deposits_centavos: sum("deposit"), loans_centavos: sum("loan"), payments_centavos: sum("payment") };
  });
}

/** Every ledger row (voided too) with what the Transactions list shows around it, like the `sf_ledger_v` view. */
export function ledgerRows(data: SfData, today: string): SfLedgerRow[] {
  const loans = new Map(buildLoans(data, today).map((loan) => [loan.id, loan]));
  const participants = new Map(data.participants.map((participant) => [participant.id, participant]));
  const distributions = new Map(data.distributions.map((distribution) => [distribution.id, distribution]));
  const loanRows = new Map(data.transactions.map((row) => [row.id, row]));

  const balanceAfter = new Map<string, number>();
  const paidSoFar = new Map<string, number>();
  for (const row of data.transactions.filter((r) => isLive(r) && r.type === "payment").sort(byDateThenCreated)) {
    const loan = loanRows.get(row.loan_id!);
    const total = (paidSoFar.get(row.loan_id!) ?? 0) + row.amount_centavos;
    paidSoFar.set(row.loan_id!, total);
    balanceAfter.set(row.id, (loan?.amount_due_centavos ?? 0) - total);
  }

  const savingsAfter = new Map<string, number>();
  const running = new Map<string, number>();
  const credit = (row: SfTransaction) => (row.type === "deposit" || row.type === "interest_share" || row.type === "payment" ? 0 : 1); // cycle_close is a debit: it comes last in a day
  for (const row of data.transactions.filter(isLive).sort((a, b) => a.tx_date.localeCompare(b.tx_date) || credit(a) - credit(b) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))) {
    const total = (running.get(row.participant_id) ?? 0) + savingsDelta(row);
    running.set(row.participant_id, total);
    savingsAfter.set(row.id, total);
  }

  return data.transactions.map((row) => {
    const loan = loans.get(row.loan_id ?? (row.type === "loan" ? row.id : ""));
    const parent = row.loan_id ? loanRows.get(row.loan_id) : undefined;
    const distribution = row.distribution_id ? distributions.get(row.distribution_id) : undefined;
    const participant = participants.get(row.participant_id);
    return {
      ...row,
      participant_name: participant?.name ?? "",
      participant_is_driver: Boolean(participant?.driver_id),
      participant_archived: Boolean(participant?.archived_at),
      loan_date: parent?.tx_date ?? null,
      loan_status: loan ? (loan.overdue ? "overdue" : loan.status) : null,
      loan_balance_centavos: loan?.balance_centavos ?? null,
      loan_interest_paid_centavos: loan?.interest_paid_centavos ?? null,
      loan_paid_centavos: loan ? loan.interest_paid_centavos + loan.principal_paid_centavos : null,
      loan_withdrawn_on: loan?.withdrawn_on ?? null,
      loan_balance_after_centavos: balanceAfter.get(row.id) ?? null,
      savings_after_centavos: savingsAfter.get(row.id) ?? null,
      distribution_date: distribution?.dist_date ?? null,
      distribution_total_centavos: distribution?.total_distributed_centavos ?? null,
      distribution_participant_count: distribution?.participant_count ?? null,
    };
  });
}

/** Highest ended total first, ties by name, rows without an ended total last (mirrors `sf_distribution_details`). */
export function sortDistributionRows(rows: readonly SfDistributionRow[]): SfDistributionRow[] {
  return [...rows].sort((a, b) => {
    if ((a.ended_total_centavos === null) !== (b.ended_total_centavos === null)) return a.ended_total_centavos === null ? 1 : -1;
    return (b.ended_total_centavos ?? 0) - (a.ended_total_centavos ?? 0) || a.participant_name.localeCompare(b.participant_name);
  });
}

/** Totals row of a distribution table; the ended total is null when any row has none saved. */
export function distributionTotals(rows: readonly SfDistributionRow[]): SfDistributionDetail["totals"] {
  return {
    ended_total_centavos: rows.length && rows.every((row) => row.ended_total_centavos !== null) ? rows.reduce((sum, row) => sum + (row.ended_total_centavos ?? 0), 0) : null,
    share_centavos: rows.reduce((sum, row) => sum + row.share_centavos, 0),
  };
}

/** One distribution's table. A distribution without saved rows (made before the year-end close) shows its shares only. */
export function distributionDetail(data: SfData, id: string): SfDistributionDetail | null {
  const distribution = data.distributions.find((item) => item.id === id);
  if (!distribution) return null;
  const saved = data.distributionRows?.[id];
  const names = new Map(data.participants.map((participant) => [participant.id, participant.name]));
  const rows = saved ?? data.transactions.filter((row) => row.distribution_id === id && row.type === "interest_share")
    .map((row) => ({ participant_id: row.participant_id, participant_name: names.get(row.participant_id) ?? "", savings_before_centavos: null, share_centavos: row.amount_centavos, ended_total_centavos: null }));
  const sorted = sortDistributionRows(rows);
  return { distribution, rows: sorted, totals: distributionTotals(sorted) };
}
