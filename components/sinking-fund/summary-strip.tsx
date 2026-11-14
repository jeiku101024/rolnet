"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPesos } from "@/lib/money/centavos";
import type { SfFundSummary } from "@/lib/sinking-fund/types";
import { useSfActions } from "@/components/sinking-fund/sinking-fund-page";

function Stat({ label, value, note, className = "" }: { label: string; value: ReactNode; note?: ReactNode; className?: string }) {
  return <Card size="sm" className={`gap-1 px-4 ${className}`}>
    <p className="text-label font-bold text-muted">{label}</p>
    <p className="font-data text-xl font-bold text-ink">{value}</p>
    {note ? <p className="text-label text-muted">{note}</p> : null}
  </Card>;
}

/** The Interest fund card (spec section 9): available, collected, distributed, expected, plus the owner's Distribute button. */
export function InterestFundCard({ summary, today }: { summary: SfFundSummary; today: string }) {
  const { isOwner, distribute, history } = useSfActions();
  const december = today.slice(5, 7) === "12";
  return <Card size="sm" className="col-span-2 gap-1 px-4 lg:col-span-1" data-testid="sf-interest-fund">
    <p className="text-label font-bold text-muted">Interest fund</p>
    <p className="font-data text-xl font-bold text-ink">{formatPesos(summary.interest_available_centavos)}</p>
    <p className="text-label text-muted">Collected {formatPesos(summary.interest_collected_centavos)} {summary.cycle_start ? "since the last distribution" : "all time"} · Distributed {formatPesos(summary.interest_distributed_centavos)} all time</p>
    <p className="text-label text-muted">Expected {formatPesos(summary.interest_expected_centavos)} from open loans</p>
    {december && isOwner ? <p className="text-label font-semibold text-warn">Year end is near. Distribute the interest fund?</p> : null}
    <div className="mt-1 flex flex-wrap items-center gap-2">
      {isOwner ? <Button type="button" size="sm" onClick={distribute}>Distribute</Button> : null}
      {isOwner ? <button type="button" className="touch-target text-label font-semibold text-brand-dark underline" onClick={history}>View history</button> : null}
    </div>
  </Card>;
}

/** Transactions view: five cards across all participants. */
export function TransactionsSummary({ summary, today }: { summary: SfFundSummary; today: string }) {
  return <section aria-label="Summary" className="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)]">
    <Stat label="Total savings" value={formatPesos(summary.total_savings_centavos)} />
    <Stat label="Loans outstanding" value={formatPesos(summary.loans_outstanding_centavos)} note={`${summary.open_loan_count} open`} />
    <Stat label="Balance to collect" value={formatPesos(summary.balance_to_collect_centavos)} />
    <Stat label="Payments received" value={formatPesos(summary.payments_received_centavos)} />
    <InterestFundCard summary={summary} today={today} />
  </section>;
}

/** Participants view: totals, including the Interest fund and the count of active participants. */
export function ParticipantsSummary({ summary, today }: { summary: SfFundSummary; today: string }) {
  return <section aria-label="Summary" className="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.5fr)_minmax(0,1fr)]">
    <Stat label="Total savings" value={formatPesos(summary.total_savings_centavos)} />
    <Stat label="Total loans" value={formatPesos(summary.loans_outstanding_centavos)} note="Principal outstanding" />
    <Stat label="Balance to collect" value={formatPesos(summary.balance_to_collect_centavos)} />
    <InterestFundCard summary={summary} today={today} />
    <Stat label="Participants" value={summary.participant_count} />
  </section>;
}
