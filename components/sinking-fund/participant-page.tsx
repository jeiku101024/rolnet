"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import type { SearchParams } from "@/lib/pagination/list-page";
import type { SfParticipantPageData } from "@/lib/sinking-fund/queries";
import { safeReturn, type SfPageParams } from "@/lib/sinking-fund/url-state";
import { DriverTag, LoanStatusTag } from "@/components/sinking-fund/type-tag";
import { ParticipantHistory } from "@/components/sinking-fund/participant-history";
import { SinkingFundShell, useSfActions } from "@/components/sinking-fund/sinking-fund-shell";

const figure = "font-data text-lg font-bold";

function Body({ data, back }: { data: SfParticipantPageData; back: string }) {
  const { isOwner, addTransaction, loanWithdrawal, data: shared } = useSfActions();
  const { participant, loans } = data;
  const openLoan = (id: string) => shared.openLoans.find((loan) => loan.id === id);

  return <section className="workspace">
    <Link href={back} className="touch-target mb-2 inline-flex items-center gap-2 text-body-sm font-semibold text-brand-dark hover:underline"><ArrowLeft aria-hidden="true" size={16} />Back to Sinking fund</Link>
    <PageHeader eyebrow="Participant" title={participant.name}
      action={<span className="flex flex-wrap items-center gap-2">{participant.driver_id ? <DriverTag /> : null}{participant.has_overdue ? <span className="status-badge bg-danger-soft text-danger">Overdue</span> : null}</span>} />
    <div className="mt-8 grid gap-6">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="sf-participant-figures">
        <div><dt className="text-label font-bold text-muted">Total savings</dt><dd className={figure}>{formatPesos(participant.savings_centavos)}</dd></div>
        <div><dt className="text-label font-bold text-muted">Total loans</dt><dd className={figure}>{formatPesos(participant.loans_centavos)}</dd></div>
        <div><dt className="text-label font-bold text-muted">Balance to pay</dt><dd className={figure}>{formatPesos(participant.balance_to_pay_centavos)}</dd></div>
        <div><dt className="text-label font-bold text-muted">Interest shares received</dt><dd className={figure}>{formatPesos(participant.interest_shares_centavos)}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => addTransaction({ participantId: participant.participant_id })}>Add transaction</Button>
        {isOwner ? <Button type="button" variant="outline" onClick={() => addTransaction({ participantId: participant.participant_id, type: "savings_withdrawal" })}>Withdraw savings</Button> : null}
      </div>

      <section aria-label="Loans" className="grid gap-2">
        <h2 className="text-section-title font-bold text-ink">Loans</h2>
        {loans.length === 0 ? <p className="text-body-sm text-muted">No loans yet.</p> : <ul className="grid gap-2 md:grid-cols-2">
          {loans.map((loan) => {
            const open = openLoan(loan.id);
            const status = loan.overdue ? "overdue" : loan.status;
            return <li key={loan.id} className="grid content-start gap-2 rounded-md border border-rule p-3 text-body-sm" data-testid="sf-detail-loan">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">Loan on {formatListDate(loan.loan_date)}</span><LoanStatusTag status={status} /></div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
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

      <ParticipantHistory history={data.history} controls={data.controls} q={data.q} />
    </div>
  </section>;
}

/** A participant's own page (feature 021): the card details and actions of the old pop-up, then their History. */
export function ParticipantPage({ data, searchParams, isOwner, params }: { data: SfParticipantPageData; searchParams: SearchParams; isOwner: boolean; params: SfPageParams }) {
  return <SinkingFundShell data={data.shared} params={params} searchParams={searchParams} isOwner={isOwner}>
    <Body data={data} back={safeReturn(searchParams.return)} />
  </SinkingFundShell>;
}
