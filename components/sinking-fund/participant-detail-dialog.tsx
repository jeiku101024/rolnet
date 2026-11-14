"use client";

import { useEffect, useRef, useState } from "react";
import { getParticipantDetail } from "@/app/actions/sinking-fund";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import { historyStep } from "@/lib/sinking-fund/url-state";
import type { SfDetail } from "@/lib/sinking-fund/queries";
import { DriverTag, LoanStatusTag } from "@/components/sinking-fund/type-tag";
import { useSfActions } from "@/components/sinking-fund/sinking-fund-page";
import { TransactionRow } from "@/components/sinking-fund/transaction-row";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; detail: SfDetail };

/**
 * The participant detail (feature 016): a centered pop-up like Add transaction, so every detail fits without sideways
 * scrolling. It is opened and closed with client state only. The figures come from the page data the moment it opens; loans
 * and history are read once when it opens (and again when the page data changes), so closing it never renders the page.
 */
export function ParticipantDetailDialog({ participantId, onClose }: { participantId: string; onClose: () => void }) {
  const { isOwner, data, addTransaction, loanWithdrawal } = useSfActions();
  const participant = data.participants.find((item) => item.participant_id === participantId);
  const [count, setCount] = useState(historyStep);
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [more, setMore] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    let live = true;
    getParticipantDetail({ participantId, historyCount: count })
      .then((result) => {
        if (!live) return;
        setMore(false);
        if (result.ok) { shown.current = true; setState({ status: "ready", detail: result.data }); }
        else if (!shown.current) setState({ status: "error", message: result.message });
      })
      .catch(() => { if (live) { setMore(false); if (!shown.current) setState({ status: "error", message: "The details could not be loaded. Try again." }); } });
    return () => { live = false; };
    // The page data changes after a save, so the loans and history are read again then.
  }, [participantId, count, attempt, data]);

  if (!participant) return null;
  const detail = state.status === "ready" ? state.detail : null;
  const openLoan = (id: string) => data.openLoans.find((loan) => loan.id === id);

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent fixedHeader title={participant.name} aria-label={`${participant.name} details`}
      description={<span className="flex flex-wrap items-center gap-2">Participant details {participant.driver_id ? <DriverTag /> : null}{participant.has_overdue ? <span className="status-badge bg-danger-soft text-danger">Overdue</span> : null}</span>}>
      <dl className="grid grid-cols-2 gap-3">
        <div><dt className="text-label font-bold text-muted">Total savings</dt><dd className="font-data text-lg font-bold">{formatPesos(participant.savings_centavos)}</dd></div>
        <div><dt className="text-label font-bold text-muted">Total loans</dt><dd className="font-data text-lg font-bold">{formatPesos(participant.loans_centavos)}</dd></div>
        <div><dt className="text-label font-bold text-muted">Balance to pay</dt><dd className="font-data text-lg font-bold">{formatPesos(participant.balance_to_pay_centavos)}</dd></div>
        <div><dt className="text-label font-bold text-muted">Interest shares received</dt><dd className="font-data text-lg font-bold">{formatPesos(participant.interest_shares_centavos)}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => addTransaction({ participantId: participant.participant_id })}>Add transaction</Button>
        {isOwner ? <Button type="button" variant="outline" onClick={() => addTransaction({ participantId: participant.participant_id, type: "savings_withdrawal" })}>Withdraw savings</Button> : null}
      </div>

      {state.status === "loading" ? <p className="text-body-sm text-muted" role="status">Loading details…</p> : null}
      {state.status === "error" ? <div className="grid gap-2" role="alert">
        <p className="text-body-sm text-danger">{state.message}</p>
        <div><Button type="button" variant="outline" onClick={() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }}>Try again</Button></div>
      </div> : null}

      {detail ? <>
        <section aria-label="Loans" className="grid gap-2">
          <h3 className="text-body font-bold">Loans</h3>
          {detail.loans.length === 0 ? <p className="text-body-sm text-muted">No loans yet.</p> : <ul className="grid gap-2">
            {detail.loans.map((loan) => {
              const open = openLoan(loan.id);
              const status = loan.overdue ? "overdue" : loan.status;
              return <li key={loan.id} className="grid gap-2 rounded-md border border-rule p-3 text-body-sm" data-testid="sf-detail-loan">
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

        <section aria-label="Transaction history" className="grid gap-2">
          <h3 className="text-body font-bold">History</h3>
          {detail.history.length === 0 ? <p className="text-body-sm text-muted">No transactions yet.</p> : <>
            <ul className="border-t border-rule" data-testid="sf-detail-history">{detail.history.map((row) => <TransactionRow key={row.id} row={row} compact />)}</ul>
            {detail.historyTotal > detail.history.length ? <div className="flex justify-center">
              <Button type="button" variant="outline" disabled={more} onClick={() => { setMore(true); setCount((value) => value + historyStep); }}>{more ? "Loading…" : "Load more"}</Button>
            </div> : null}
          </>}
        </section>
      </> : null}
    </DialogContent>
  </Dialog>;
}
