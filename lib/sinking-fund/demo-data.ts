import { addDays, fleetToday } from "@/lib/dates/fleet-date";
import { demoDrivers } from "@/lib/demo/mode";
import { fundAt, savingsAt } from "@/lib/sinking-fund/ledger";
import { loanAmountDue, loanDueDate, loanInterest, proportionalShares } from "@/lib/sinking-fund/rules";
import type { SfData } from "@/lib/sinking-fund/aggregate";
import type { SfDistribution, SfDistributionRow, SfParticipant, SfTransaction } from "@/lib/sinking-fund/types";

/**
 * Seeded Sinking fund ledger for demo mode (research R11): enough rows for "Load more", every loan status
 * (open, overdue, paid, withdrawn), an archived participant, a proportional distribution that closed the year for
 * three participants (one with no savings), an older equal-share distribution with no saved ended totals, and a
 * savings withdrawal.
 * Amounts are centavos. Dates are relative to the business "today" so overdue status stays correct.
 */
const today = fleetToday();
const id = (group: number, index: number) => `00000000-0000-4000-8000-${String(15000 + group).padStart(6, "0")}${String(index).padStart(6, "0")}`;
const stamp = (days: number, order: number) => `${addDays(today, days)}T08:${String(order % 60).padStart(2, "0")}:00Z`;

const people = [
  { name: "Ana Reyes", driver: demoDrivers[0]?.id ?? null },
  { name: "Ben Cruz", driver: null },
  { name: "Cora Santos", driver: demoDrivers[1]?.id ?? null },
  { name: "Dino Lim", driver: null },
  { name: "Elena Ramos", driver: null },
  { name: "Felix Tan", driver: null },
  { name: "Hugo Dela Cruz", driver: null },
  { name: "Iris Ortiz", driver: null, archived: true },
];

export const demoSfParticipants: SfParticipant[] = people.map((person, index) => ({
  id: id(1, index + 1),
  name: person.name,
  driver_id: person.driver,
  notes: null,
  archived_at: person.archived ? stamp(-3, 0) : null,
  updated_at: stamp(-60, index),
}));
const [ana, ben, cora, dino, elena, felix, hugo, iris] = demoSfParticipants.map((participant) => participant.id);

let order = 0;
const blank = (participant: string, type: SfTransaction["type"], day: number, amount: number): SfTransaction => {
  order += 1;
  return {
    id: id(2, order), participant_id: participant, type, amount_centavos: amount, tx_date: addDays(today, day), notes: null,
    loan_id: null, distribution_id: null, interest_rate_bp: null, interest_centavos: null, amount_due_centavos: null, due_date: null,
    interest_part_centavos: null, principal_part_centavos: null, interest_set_by: null, interest_waived_centavos: null,
    voided_at: null, void_reason: null, created_at: stamp(day, order), updated_at: stamp(day, order),
  };
};
const deposit = (participant: string, day: number, amount: number) => blank(participant, "deposit", day, amount);
const loan = (participant: string, day: number, amount: number): SfTransaction => {
  const date = addDays(today, day);
  return { ...blank(participant, "loan", day, amount), interest_rate_bp: 500, interest_centavos: loanInterest(amount), amount_due_centavos: loanAmountDue(amount), due_date: loanDueDate(date) };
};
const payment = (participant: string, parent: SfTransaction, day: number, amount: number, interest: number, by: "owner" | "default" = "default"): SfTransaction =>
  ({ ...blank(participant, "payment", day, amount), loan_id: parent.id, interest_part_centavos: interest, principal_part_centavos: amount - interest, interest_set_by: by });

const rows: SfTransaction[] = [];
const depositPlan: [string, number[]][] = [
  [ana, [300000, 200000, 150000, 100000]], [ben, [200000, 100000, 100000, 50000]], [cora, [150000, 150000, 100000, 50000]],
  [dino, [100000, 100000, 50000, 50000]], [elena, [250000, 100000, 100000, 50000]], [felix, [50000, 50000, 50000, 50000]],
];
[-80, -60, -40, -20].forEach((day, index) => depositPlan.forEach(([participant, amounts]) => rows.push(deposit(participant, day, amounts[index]))));
rows.push(deposit(iris, -90, 100000));

// Open loan with a part payment (default: interest first).
const anaLoan = loan(ana, -15, 100000);
rows.push(anaLoan, payment(ana, anaLoan, -8, 40000, 5000));
// Overdue loan: due date passed with a balance.
const coraLoan = loan(cora, -55, 200000);
rows.push(coraLoan, payment(cora, coraLoan, -50, 50000, 10000));
// Paid loan: the owner took the interest on the second payment.
const benLoan = loan(ben, -50, 100000);
rows.push(benLoan, payment(ben, benLoan, -45, 50000, 0, "owner"), payment(ben, benLoan, -25, 55000, 5000, "owner"));
// Withdrawn loan: closed by the owner after the due date.
const elenaLoan = loan(elena, -75, 100000);
rows.push(elenaLoan, payment(elena, elenaLoan, -65, 30000, 5000));
rows.push({ ...blank(elena, "loan_withdrawal", -10, 75000), loan_id: elenaLoan.id, interest_waived_centavos: 0 });
// A loan taken today with nothing paid yet.
rows.push(loan(dino, -5, 50000));

// A year-end close, proportional to savings: Dino, Felix, and Hugo (who had no savings) took part. Their ended totals
// were saved and their savings went back to zero; later rows below start the new cycle.
const closeDay = -26;
const closeDate = addDays(today, closeDay);
const ticked = [dino, felix, hugo];
const available = fundAt(rows, [], closeDate);
const split = proportionalShares(available, ticked.map((participant) => ({ id: participant, savingsCentavos: savingsAt(rows.filter((row) => row.participant_id === participant), closeDate) })));
const nameOf = (participant: string) => demoSfParticipants.find((item) => item.id === participant)?.name ?? "";
const closeRows: SfDistributionRow[] = ticked.map((participant) => {
  const before = savingsAt(rows.filter((row) => row.participant_id === participant), closeDate);
  const share = split.shares.get(participant) ?? 0;
  return { participant_id: participant, participant_name: nameOf(participant), savings_before_centavos: before, share_centavos: share, ended_total_centavos: before + share };
});
const closeDistribution: SfDistribution = {
  id: id(3, 2), dist_date: closeDate, year: Number(closeDate.slice(0, 4)), available_before_centavos: available, per_participant_centavos: null, participant_count: ticked.length,
  share_count: closeRows.filter((row) => row.share_centavos > 0).length, total_distributed_centavos: split.total, remainder_centavos: split.remainder,
  notes: "Demo year-end close", voided_at: null, void_reason: null, updated_at: stamp(closeDay, 2),
};
for (const row of closeRows) {
  if (row.share_centavos > 0) rows.push({ ...blank(row.participant_id, "interest_share", closeDay, row.share_centavos), distribution_id: closeDistribution.id });
  if ((row.ended_total_centavos ?? 0) > 0) rows.push({ ...blank(row.participant_id, "cycle_close", closeDay, row.ended_total_centavos ?? 0), distribution_id: closeDistribution.id, notes: "Year-end close" });
}

// An older equal-share distribution (made before the year-end close): no saved ended totals ("Not recorded").
const legacyDistribution: SfDistribution = {
  id: id(3, 1), dist_date: addDays(today, -3), year: Number(addDays(today, -3).slice(0, 4)), available_before_centavos: 6001, per_participant_centavos: 2000, participant_count: 3,
  share_count: 3, total_distributed_centavos: 6000, remainder_centavos: 1, notes: "Demo equal-share distribution", voided_at: null, void_reason: null, updated_at: stamp(-3, 1),
};
for (const participant of [ana, ben, cora]) rows.push({ ...blank(participant, "interest_share", -3, 2000), distribution_id: legacyDistribution.id });

// Ben saves a little every day for a week after his loan is paid, so his history needs "Load more" (more than 10 rows).
for (let day = -24; day <= -17; day += 1) rows.push(deposit(ben, day, 1000));

// A savings withdrawal (the owner paid money back out) and the archived participant's payout.
rows.push(blank(felix, "savings_withdrawal", -2, 30000), blank(iris, "savings_withdrawal", -4, 100000));

export const demoSfDistributions: SfDistribution[] = [legacyDistribution, closeDistribution];
export const demoSfData: SfData = {
  participants: demoSfParticipants, transactions: rows, distributions: demoSfDistributions,
  distributionRows: { [closeDistribution.id]: closeRows },
};
export const demoSfSettings = { default_interest_prefill: "first" as const };
