"use client";

import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DriverTag, LoanStatusTag, TypeTag, VoidedTag } from "@/components/sinking-fund/type-tag";
import { useSfActions } from "@/components/sinking-fund/sinking-fund-page";
import { formatPesos } from "@/lib/money/centavos";
import { formatDayMonth, formatListDate } from "@/lib/sinking-fund/format";
import type { SfLedgerRow } from "@/lib/sinking-fund/types";

const amountClass = "font-data font-semibold";

/** The Amount column: + for money in, - for money out, and the closed balance with the word "closed" for a loan Withdrawal. */
function Amount({ row }: { row: SfLedgerRow }) {
  const money = formatPesos(row.amount_centavos);
  if (row.type === "loan_withdrawal") return <span className={amountClass}>{money} <span className="font-sans font-normal text-muted">closed</span></span>;
  const sign = row.type === "loan" || row.type === "savings_withdrawal" ? "-" : "+";
  return <span className={amountClass}>{sign}{money}</span>;
}

/** The Details column, per type (spec section 11). */
function Details({ row }: { row: SfLedgerRow }) {
  const savingsAfter = row.savings_after_centavos;
  switch (row.type) {
    case "deposit":
    case "savings_withdrawal":
      return <span>{savingsAfter !== null ? `Savings after: ${formatPesos(savingsAfter)}` : ""}</span>;
    case "loan": {
      const interest = row.interest_centavos ?? 0;
      if (row.loan_status === "withdrawn") {
        const paid = row.loan_paid_centavos ?? 0;
        return <span className="grid gap-1">
          <span><LoanStatusTag status="withdrawn" /> Paid {formatPesos(paid)} of {formatPesos(row.amount_due_centavos ?? 0)}. {formatPesos((row.amount_due_centavos ?? 0) - paid)} closed as withdrawal{row.loan_withdrawn_on ? ` on ${formatListDate(row.loan_withdrawn_on)}` : ""}.</span>
        </span>;
      }
      return <span className="grid gap-1">
        <span>5% interest ({formatPesos(interest)}) · To pay {formatPesos(row.amount_due_centavos ?? 0)} · Due {row.due_date ? formatDayMonth(row.due_date) : ""}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
          {row.loan_status ? <LoanStatusTag status={row.loan_status} /> : null}
          <span>Balance {formatPesos(row.loan_balance_centavos ?? 0)}</span>
          <span>· Interest collected {formatPesos(row.loan_interest_paid_centavos ?? 0)} of {formatPesos(interest)}</span>
        </span>
      </span>;
    }
    case "payment": {
      const after = row.loan_balance_after_centavos;
      return <span>For loan on {row.loan_date ? formatListDate(row.loan_date) : "—"} · {formatPesos(row.interest_part_centavos ?? 0)} interest to fund · {formatPesos(row.principal_part_centavos ?? 0)} to savings · {after === 0 ? "Loan fully paid" : after !== null ? `Balance after ${formatPesos(after)}` : ""}</span>;
    }
    case "loan_withdrawal":
      return <span>Loan on {row.loan_date ? formatListDate(row.loan_date) : "—"} closed. {formatPesos(row.amount_centavos)} unpaid ({formatPesos(row.interest_waived_centavos ?? 0)} interest waived). Savings unchanged.</span>;
    case "interest_share":
      return <span>Share of {formatPesos(row.distribution_total_centavos ?? 0)} distributed on {row.distribution_date ? formatListDate(row.distribution_date) : "—"} ({row.distribution_participant_count ?? 0} participants) · added to savings</span>;
  }
}

/** One row's 3-dot menu (spec section 11): View participant, Add payment, Mark as withdrawal, Change interest part, Void. */
function RowMenu({ row }: { row: SfLedgerRow }) {
  const { isOwner, data, viewParticipant, addTransaction, loanWithdrawal, changeInterest, voidRow } = useSfActions();
  const openLoan = row.type === "loan" ? data.openLoans.find((loan) => loan.id === row.id) : undefined;
  const voided = Boolean(row.voided_at);
  const ownerOnly = (label: string, action: () => void, danger = false) => isOwner
    ? <DropdownMenuItem className={danger ? "text-danger" : undefined} onClick={action}>{label}</DropdownMenuItem>
    : <DropdownMenuItem disabled title="Owner only">{label} (owner only)</DropdownMenuItem>;
  return <DropdownMenu>
    <DropdownMenuTrigger className="touch-target inline-flex w-11 items-center justify-center rounded-md text-ink hover:bg-brand-soft" aria-label={`Options for ${row.participant_name}'s ${row.type.replace("_", " ")}`}><MoreHorizontal aria-hidden="true" size={18} /></DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => viewParticipant(row.participant_id)}>View participant</DropdownMenuItem>
      {openLoan ? <DropdownMenuItem onClick={() => addTransaction({ participantId: row.participant_id, type: "payment", loanId: row.id })}>Add payment</DropdownMenuItem> : null}
      {openLoan?.overdue ? ownerOnly("Mark as withdrawal", () => loanWithdrawal(openLoan)) : null}
      {row.type === "payment" && !voided && row.loan_status !== "withdrawn" ? ownerOnly("Change interest part", () => changeInterest(row)) : null}
      {!voided ? ownerOnly(row.type === "interest_share" ? "Void distribution" : "Void transaction", () => voidRow(row), true) : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}

export const rowGrid = "md:grid-cols-[6.5rem_minmax(8rem,1fr)_8.5rem_9rem_minmax(14rem,2.2fr)_2.75rem]";

/** A Transactions row: a table-like grid from 768 px, a card on phones. Voided rows are struck through with a "Voided" tag. */
export function TransactionRow({ row }: { row: SfLedgerRow }) {
  const voided = Boolean(row.voided_at);
  return <li className={`grid gap-2 border-b border-rule px-3 py-3 text-body-sm md:items-start md:gap-4 ${rowGrid}`} data-testid="sf-row">
    <span className="font-data text-muted"><span className="sr-only">Date </span>{formatListDate(row.tx_date)}</span>
    <span className="min-w-0 font-semibold"><span className="sr-only">Participant </span>{row.participant_name} {row.participant_is_driver ? <DriverTag /> : null}</span>
    <span className="flex flex-wrap items-center gap-1"><span className="sr-only">Type </span><TypeTag type={row.type} />{voided ? <VoidedTag /> : null}</span>
    <span className={voided ? "line-through" : undefined}><span className="sr-only">Amount </span><Amount row={row} /></span>
    <span className={`min-w-0 ${voided ? "text-muted line-through" : ""}`}><span className="sr-only">Details </span><Details row={row} />
      {row.notes ? <span className="mt-1 block text-muted" title={row.notes}>{row.notes}</span> : null}
      {voided && row.void_reason ? <span className="mt-1 block text-muted no-underline">Voided: {row.void_reason}</span> : null}
    </span>
    <span className="justify-self-end"><RowMenu row={row} /></span>
  </li>;
}
