"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatPesos } from "@/lib/money/centavos";
import type { SearchParams } from "@/lib/pagination/list-page";
import type { SfParticipantPageData } from "@/lib/sinking-fund/queries";
import { safeReturn, type SfPageParams } from "@/lib/sinking-fund/url-state";
import { DriverTag } from "@/components/sinking-fund/type-tag";
import { ParticipantLoans } from "@/components/sinking-fund/participant-loans";
import { ParticipantHistory } from "@/components/sinking-fund/participant-history";
import { SinkingFundShell, useSfActions } from "@/components/sinking-fund/sinking-fund-shell";

const figure = "font-data text-lg font-bold";

function Body({ data, back }: { data: SfParticipantPageData; back: string }) {
  const { isOwner, addTransaction, data: shared } = useSfActions();
  const { participant, loans } = data;

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

      <ParticipantLoans loans={loans} payments={data.payments} today={shared.today} isOwner={isOwner} />

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
