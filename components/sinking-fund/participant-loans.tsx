"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-field";
import { Pagination } from "@/components/ui/pagination";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import {
  activeSummary, barShares, closedView, closedYears, daysLeft, dueText, paymentsByLoan, percentPaid, shownBalance, sortActive, splitLoans,
} from "@/lib/sinking-fund/loan-list";
import type { SfLoan, SfLoanPayment } from "@/lib/sinking-fund/types";
import { LoanStatusTag } from "@/components/sinking-fund/type-tag";
import { useSfActions } from "@/components/sinking-fund/sinking-fund-shell";

type Tab = "active" | "closed";

const rowBase = "touch-target grid w-full grid-cols-2 items-center gap-x-3 gap-y-2 px-3 py-3 text-left text-body-sm hover:bg-brand-soft md:grid-cols-4";
const tabBase = "touch-target border-b-2 px-3 text-body-sm font-semibold";

function Chevron({ open }: { open: boolean }) {
  const Icon = open ? ChevronUp : ChevronDown;
  return <Icon aria-hidden="true" size={16} className="shrink-0 text-muted" />;
}

/** Two-segment bar: interest paid, then principal paid, out of the amount due. A text legend always accompanies it. */
function PaidBar({ loan }: { loan: SfLoan }) {
  const shares = barShares(loan);
  return <div className="flex h-2 overflow-hidden rounded-sm bg-rule" role="img" aria-label={`${percentPaid(loan)}% paid`}>
    <span className="block h-2 bg-violet" style={{ width: `${shares.interest}%` }} />
    <span className="block h-2 bg-ok" style={{ width: `${shares.principal}%` }} />
  </div>;
}

function PaymentList({ payments }: { payments: SfLoanPayment[] }) {
  if (payments.length === 0) return <p className="text-body-sm text-muted">No payments yet.</p>;
  return <ul className="grid divide-y divide-rule text-body-sm" aria-label="Payments">
    {payments.map((payment) => <li key={payment.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2" data-testid="sf-loan-payment">
      <span>{formatListDate(payment.tx_date)}</span>
      <span className="font-data">{formatPesos(payment.amount_centavos)} <span className="text-muted">with {formatPesos(payment.interest_part_centavos)} interest and {formatPesos(payment.principal_part_centavos)} principal</span></span>
    </li>)}
  </ul>;
}

function Breakdown({ loan }: { loan: SfLoan }) {
  return <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md bg-canvas px-3 py-2 text-body-sm">
    <span className="font-data">{formatPesos(loan.principal_centavos)}</span><span className="text-muted">principal</span>
    <span aria-hidden="true">+</span>
    <span className="font-data">{formatPesos(loan.interest_centavos)}</span><span className="text-muted">interest</span>
    <span aria-hidden="true">=</span>
    <span className="font-data font-bold">{formatPesos(loan.amount_due_centavos)}</span><span className="text-muted">due</span>
  </p>;
}

function ActiveDetail({ loan, payments, isOwner, id }: { loan: SfLoan; payments: SfLoanPayment[]; isOwner: boolean; id: string }) {
  const { addTransaction, loanWithdrawal, data } = useSfActions();
  const openLoan = data.openLoans.find((item) => item.id === loan.id);
  const balance = shownBalance(loan);
  return <div id={id} className="grid gap-3 border-t border-dashed border-rule bg-canvas/50 px-3 py-4" data-testid="sf-loan-detail">
    <Breakdown loan={loan} />
    <div className="grid gap-1 text-label text-muted">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="block size-2.5 rounded-sm bg-violet" />Interest paid {formatPesos(loan.interest_paid_centavos)} of {formatPesos(loan.interest_centavos)}</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="block size-2.5 rounded-sm bg-ok" />Principal paid {formatPesos(loan.principal_paid_centavos)} of {formatPesos(loan.principal_centavos)}</span>
        <span className="font-bold text-ink">{percentPaid(loan)}% paid</span>
      </p>
      <p>Balance <span className="font-data font-bold text-ink">{formatPesos(balance)}</span>, due {formatListDate(loan.due_date)}</p>
    </div>
    <PaymentList payments={payments} />
    <div className="flex flex-wrap gap-2">
      <Button type="button" data-testid="sf-loan-add-payment" onClick={() => addTransaction({ participantId: loan.participant_id, type: "payment", loanId: loan.id })}>Add payment</Button>
      {balance > 0 ? <Button type="button" variant="outline" data-testid="sf-loan-pay-full" onClick={() => addTransaction({ participantId: loan.participant_id, type: "payment", loanId: loan.id, amountCentavos: balance })}>Pay full balance ({formatPesos(balance)})</Button> : null}
      {loan.overdue ? (isOwner && openLoan
        ? <Button type="button" variant="destructive" data-testid="sf-loan-withdraw" onClick={() => loanWithdrawal(openLoan)}>Mark as withdrawal</Button>
        : <Button type="button" variant="outline" disabled title="Owner only" data-testid="sf-loan-withdraw">Mark as withdrawal (owner only)</Button>) : null}
    </div>
  </div>;
}

function ClosedDetail({ loan, payments, id }: { loan: SfLoan; payments: SfLoanPayment[]; id: string }) {
  const paid = loan.interest_paid_centavos + loan.principal_paid_centavos;
  return <div id={id} className="grid gap-3 border-t border-dashed border-rule bg-canvas/50 px-3 py-4" data-testid="sf-loan-detail">
    <Breakdown loan={loan} />
    {loan.status === "withdrawn"
      ? <p className="text-body-sm text-muted">Paid {formatPesos(paid)} of {formatPesos(loan.amount_due_centavos)}. {formatPesos(Math.max(loan.amount_due_centavos - paid, 0))} closed as withdrawal{loan.withdrawn_on ? ` on ${formatListDate(loan.withdrawn_on)}` : ""}.</p>
      : <p className="text-body-sm text-muted">Repaid in full.</p>}
    <PaymentList payments={payments} />
  </div>;
}

function ActiveRow({ loan, today, open, onToggle, panelId }: { loan: SfLoan; today: string; open: boolean; onToggle: () => void; panelId: string }) {
  const due = dueText(daysLeft(loan.due_date, today));
  const dueTone = due.tone === "overdue" ? "font-bold text-danger" : due.tone === "soon" ? "font-bold text-warn" : "text-ink";
  return <button type="button" className={`${rowBase} ${loan.overdue ? "border-l-4 border-l-danger" : ""} ${open ? "bg-brand-soft" : ""}`} aria-expanded={open} aria-controls={panelId} onClick={onToggle} data-testid="sf-loan-row">
    <span className="grid gap-1">
      <LoanStatusTag status={loan.overdue ? "overdue" : "open"} />
      <span className="font-semibold">{formatListDate(loan.loan_date)}</span>
      <span className="font-data text-label text-muted">{formatPesos(loan.principal_centavos)} borrowed</span>
    </span>
    <span className="flex items-center justify-end gap-2 md:order-3 md:justify-between">
      <span className="grid gap-1 text-right md:text-left"><span className={dueTone}>{due.text}</span><span className="text-label text-muted">Due {formatListDate(loan.due_date)}</span></span>
      <Chevron open={open} />
    </span>
    <span className="col-span-2 grid gap-1 md:order-2 md:col-span-2">
      <span><span className={`font-data text-body font-bold ${loan.overdue ? "text-danger" : "text-ink"}`}>{formatPesos(shownBalance(loan))}</span> <span className="text-label text-muted">of {formatPesos(loan.amount_due_centavos)}</span></span>
      <PaidBar loan={loan} />
    </span>
  </button>;
}

function ClosedRow({ loan, closedOn, open, onToggle, panelId }: { loan: SfLoan; closedOn: string | null; open: boolean; onToggle: () => void; panelId: string }) {
  return <button type="button" className={`${rowBase} ${open ? "bg-brand-soft" : ""}`} aria-expanded={open} aria-controls={panelId} onClick={onToggle} data-testid="sf-loan-row">
    <span className="grid gap-1">
      <LoanStatusTag status={loan.status} />
      <span className="font-semibold">{formatListDate(loan.loan_date)}</span>
    </span>
    <span className="flex items-center justify-end gap-2 md:order-3 md:justify-between">
      <span className="text-label text-muted">{closedOn ? `${loan.status === "paid" ? "Paid off" : "Closed"} ${formatListDate(closedOn)}` : ""}</span>
      <Chevron open={open} />
    </span>
    <span className="col-span-2 md:order-2 md:col-span-2"><span className="font-data font-bold">{formatPesos(loan.principal_centavos)}</span> <span className="text-label text-muted">plus {formatPesos(loan.interest_centavos)} interest</span></span>
  </button>;
}

/**
 * The participant page's Loans section (feature 022): Active and Paid and closed tabs, one compact row per loan,
 * one row open at a time, and the closed list paged five at a time with a year filter. Everything is already on the
 * page, so tabs, rows, years and pages are local state.
 */
export function ParticipantLoans({ loans, payments, today, isOwner }: { loans: SfLoan[]; payments: SfLoanPayment[]; today: string; isOwner: boolean }) {
  const { searchParams } = useSfActions();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>("active");
  const [openActive, setOpenActive] = useState<string | null>(null);
  const [openClosed, setOpenClosed] = useState<string | null>(null);
  const [year, setYear] = useState("all");
  const [page, setPage] = useState(1);

  const { active, closed } = useMemo(() => splitLoans(loans), [loans]);
  const ordered = useMemo(() => sortActive(active), [active]);
  const summary = useMemo(() => activeSummary(active), [active]);
  const byLoan = useMemo(() => paymentsByLoan(payments), [payments]);
  const years = useMemo(() => closedYears(closed), [closed]);
  const activeYear = year === "all" || years.includes(year) ? year : "all";
  const view = useMemo(() => closedView(closed, activeYear, page), [closed, activeYear, page]);
  const openActiveId = ordered.some((loan) => loan.id === openActive) ? openActive : null;
  const openClosedId = view.rows.some((loan) => loan.id === openClosed) ? openClosed : null;
  const panel = (loan: SfLoan) => `sf-loan-panel-${loan.id}`;
  const closedOn = (loan: SfLoan) => loan.withdrawn_on ?? (byLoan.get(loan.id) ?? []).at(-1)?.tx_date ?? null;

  if (loans.length === 0) return <section aria-label="Loans" className="grid gap-2" data-testid="sf-loans">
    <h2 className="text-section-title font-bold text-ink">Loans</h2>
    <p className="text-body-sm text-muted">No loans yet.</p>
  </section>;

  return <section aria-label="Loans" className="grid gap-3" data-testid="sf-loans">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h2 className="text-section-title font-bold text-ink">Loans</h2>
      <p className="flex flex-wrap items-center gap-2 text-label" data-testid="sf-loans-summary">
        <span className="status-badge bg-canvas text-ink">{summary.count} active</span>
        <span className="status-badge bg-canvas text-ink">{formatPesos(summary.balanceCentavos)} to pay</span>
        {summary.overdue > 0 ? <span className="status-badge bg-danger-soft text-danger"><TriangleAlert aria-hidden="true" size={14} />{summary.overdue} overdue</span> : null}
      </p>
    </div>

    <div role="tablist" aria-label="Loans" className="flex border-b border-rule">
      <button type="button" role="tab" id="sf-loans-tab-active" aria-selected={tab === "active"} aria-controls="sf-loans-panel" className={`${tabBase} ${tab === "active" ? "border-brand-dark text-ink" : "border-transparent text-muted hover:text-ink"}`} onClick={() => setTab("active")}>Active ({active.length})</button>
      <button type="button" role="tab" id="sf-loans-tab-closed" aria-selected={tab === "closed"} aria-controls="sf-loans-panel" className={`${tabBase} ${tab === "closed" ? "border-brand-dark text-ink" : "border-transparent text-muted hover:text-ink"}`} onClick={() => setTab("closed")}>Paid and closed ({closed.length})</button>
    </div>

    <div role="tabpanel" id="sf-loans-panel" aria-labelledby={`sf-loans-tab-${tab}`} className="grid">
      {tab === "active" ? (ordered.length === 0
        ? <p className="py-3 text-body-sm text-muted">No active loans.</p>
        : <ul className="divide-y divide-rule rounded-md border border-rule bg-surface">
          {ordered.map((loan) => {
            const open = openActiveId === loan.id;
            return <li key={loan.id}>
              <ActiveRow loan={loan} today={today} open={open} panelId={panel(loan)} onToggle={() => setOpenActive(open ? null : loan.id)} />
              {open ? <ActiveDetail loan={loan} payments={byLoan.get(loan.id) ?? []} isOwner={isOwner} id={panel(loan)} /> : null}
            </li>;
          })}
        </ul>)
        : (closed.length === 0
          ? <p className="py-3 text-body-sm text-muted">No paid or closed loans yet.</p>
          : <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-body-sm text-muted" role="status">{view.total} loan{view.total === 1 ? "" : "s"}, {formatPesos(view.repaidCentavos)} repaid</p>
              <label className="flex items-center gap-2 text-body-sm font-semibold text-ink">Year
                <Select value={activeYear} data-testid="sf-loans-year" onChange={(event) => { setYear(event.target.value); setPage(1); setOpenClosed(null); }}>
                  <option value="all">All years</option>
                  {years.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </label>
            </div>
            <ul className="divide-y divide-rule rounded-md border border-rule bg-surface">
              {view.rows.map((loan) => {
                const open = openClosedId === loan.id;
                return <li key={loan.id}>
                  <ClosedRow loan={loan} closedOn={closedOn(loan)} open={open} panelId={panel(loan)} onToggle={() => setOpenClosed(open ? null : loan.id)} />
                  {open ? <ClosedDetail loan={loan} payments={byLoan.get(loan.id) ?? []} id={panel(loan)} /> : null}
                </li>;
              })}
            </ul>
            <Pagination pathname={pathname} searchParams={searchParams} state={view} onPage={(next) => { setPage(next); setOpenClosed(null); }} />
          </div>)}
    </div>
  </section>;
}
