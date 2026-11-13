"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { listHref } from "@/lib/pagination/list-page";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import { historyStep } from "@/lib/sinking-fund/url-state";
import type { SfDetail } from "@/lib/sinking-fund/queries";
import { DriverTag, LoanStatusTag } from "@/components/sinking-fund/type-tag";
import { useSfActions } from "@/components/sinking-fund/sinking-fund-page";
import { TransactionRow } from "@/components/sinking-fund/transaction-row";

/** The participant detail (spec section 14), opened from a card, a list row, or the Top participants view. */
export function ParticipantDetailSheet({ detail }: { detail: SfDetail }) {
  const { isOwner, params, searchParams, addTransaction, loanWithdrawal, data } = useSfActions();
  const router = useRouter();
  const pathname = usePathname();
  const { participant, loans, history, historyTotal } = detail;
  const close = () => router.replace(listHref(pathname, searchParams, { detail: null, hn: null }), { scroll: false });
  const openLoan = (id: string) => data.openLoans.find((loan) => loan.id === id);

  return <Sheet open onOpenChange={(open) => { if (!open) close(); }}>
    <SheetContent side="right" showCloseButton={false} className="data-[side=right]:w-full data-[side=right]:max-w-2xl overflow-y-auto" aria-label={`${participant.name} details`}>
      <div className="grid gap-5 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetTitle className="text-section-title font-bold">{participant.name}</SheetTitle>
            <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">Participant details {participant.driver_id ? <DriverTag /> : null}{participant.has_overdue ? <span className="status-badge bg-danger-soft text-danger">Overdue</span> : null}</SheetDescription>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close participant details" onClick={close}><X aria-hidden="true" /></Button>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><dt className="text-label font-bold text-muted">Total savings</dt><dd className="font-data text-lg font-bold">{formatPesos(participant.savings_centavos)}</dd></div>
          <div><dt className="text-label font-bold text-muted">Total loans</dt><dd className="font-data text-lg font-bold">{formatPesos(participant.loans_centavos)}</dd></div>
          <div><dt className="text-label font-bold text-muted">Balance to pay</dt><dd className="font-data text-lg font-bold">{formatPesos(participant.balance_to_pay_centavos)}</dd></div>
          <div><dt className="text-label font-bold text-muted">Interest shares received</dt><dd className="font-data text-lg font-bold">{formatPesos(participant.interest_shares_centavos)}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => addTransaction({ participantId: participant.participant_id })}>Add transaction</Button>
          {isOwner ? <Button type="button" variant="outline" onClick={() => addTransaction({ participantId: participant.participant_id, type: "savings_withdrawal" })}>Withdraw savings</Button> : null}
        </div>

        <section aria-label="Loans" className="grid gap-2">
          <h3 className="text-body font-bold">Loans</h3>
          {loans.length === 0 ? <p className="text-body-sm text-muted">No loans yet.</p> : <ul className="grid gap-2">
            {loans.map((loan) => {
              const open = openLoan(loan.id);
              const status = loan.overdue ? "overdue" : loan.status;
              return <li key={loan.id} className="grid gap-2 rounded-md border border-rule p-3 text-body-sm" data-testid="sf-detail-loan">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">Loan on {formatListDate(loan.loan_date)}</span><LoanStatusTag status={status} /></div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  <div><dt className="text-muted">Principal</dt><dd className="font-data">{formatPesos(loan.principal_centavos)}</dd></div>
                  <div><dt className="text-muted">Interest</dt><dd className="font-data">{formatPesos(loan.interest_centavos)}</dd></div>
                  <div><dt className="text-muted">Amount due</dt><dd className="font-data">{formatPesos(loan.amount_due_centavos)}</dd></div>
                  <div><dt className="text-muted">Interest paid</dt><dd className="font-data">{formatPesos(loan.interest_paid_centavos)}</dd></div>
                  <div><dt className="text-muted">Principal paid</dt><dd className="font-data">{formatPesos(loan.principal_paid_centavos)}</dd></div>
                  <div><dt className="text-muted">Balance</dt><dd className="font-data">{formatPesos(loan.balance_centavos)}</dd></div>
                  <div><dt className="text-muted">Due date</dt><dd>{formatListDate(loan.due_date)}</dd></div>
                </dl>
                {loan.status === "withdrawn" ? <p className="text-muted">Paid {formatPesos(loan.interest_paid_centavos + loan.principal_paid_centavos)} of {formatPesos(loan.amount_due_centavos)}. {formatPesos(loan.amount_due_centavos - loan.interest_paid_centavos - loan.principal_paid_centavos)} closed as withdrawal{loan.withdrawn_on ? ` on ${formatListDate(loan.withdrawn_on)}` : ""}.</p> : null}
                {open ? <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => addTransaction({ participantId: loan.participant_id, type: "payment", loanId: loan.id })}>Add payment</Button>
                  {loan.overdue ? (isOwner
                    ? <Button type="button" variant="destructive" onClick={() => loanWithdrawal(open)}>Mark as withdrawal</Button>
                    : <Button type="button" variant="outline" disabled title="Owner only">Mark as withdrawal (owner only)</Button>) : null}
                </div> : null}
              </li>;
            })}
          </ul>}
        </section>

        <section aria-label="Transaction history" className="grid gap-2">
          <h3 className="text-body font-bold">History</h3>
          {history.length === 0 ? <p className="text-body-sm text-muted">No transactions yet.</p> : <>
            <ul className="border-t border-rule">{history.map((row) => <TransactionRow key={row.id} row={row} />)}</ul>
            {historyTotal > history.length ? <div className="flex justify-center">
              <Link scroll={false} className="touch-target inline-flex items-center rounded-md border border-control-border bg-surface px-4 text-body-sm font-semibold hover:bg-brand-soft"
                href={listHref(pathname, searchParams, { hn: params.hn + historyStep })}>Load more</Link>
            </div> : null}
          </>}
        </section>
      </div>
    </SheetContent>
  </Sheet>;
}

