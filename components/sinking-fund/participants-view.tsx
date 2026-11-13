"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/feedback";
import { FilterSelect } from "@/components/ui/list-controls";
import { ListSearch } from "@/components/ui/list-search";
import { listHref } from "@/lib/pagination/list-page";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import { participantSorts, type ParticipantSort } from "@/lib/sinking-fund/url-state";
import type { SfParticipantSummary } from "@/lib/sinking-fund/types";
import { MonthlyBars, SavingsDonut } from "@/components/sinking-fund/charts/charts";
import { DriverTag } from "@/components/sinking-fund/type-tag";
import { PrimaryActions, useSfActions } from "@/components/sinking-fund/sinking-fund-page";
import { ParticipantsSummary } from "@/components/sinking-fund/summary-strip";

const sortLabels: Record<ParticipantSort, string> = { savings: "Highest savings", name: "Name A to Z", balance: "Highest balance to pay" };

function sortParticipants(rows: SfParticipantSummary[], sort: ParticipantSort) {
  const copy = [...rows];
  if (sort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "balance") return copy.sort((a, b) => b.balance_to_pay_centavos - a.balance_to_pay_centavos || a.name.localeCompare(b.name));
  return copy.sort((a, b) => b.savings_centavos - a.savings_centavos || a.name.localeCompare(b.name));
}

function ParticipantCard({ participant }: { participant: SfParticipantSummary }) {
  const { isOwner, addTransaction, viewParticipant, rename, archive } = useSfActions();
  return <Card className="gap-3 px-4" data-testid="sf-participant-card">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="truncate text-body font-bold text-ink">{participant.name}</h3>
        <div className="mt-1 flex flex-wrap gap-1">
          {participant.driver_id ? <DriverTag /> : null}
          {participant.has_overdue ? <span className="status-badge bg-danger-soft text-danger">Overdue</span> : null}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="touch-target inline-flex w-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-brand-soft" aria-label={`Options for ${participant.name}`}><MoreHorizontal aria-hidden="true" size={18} /></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => viewParticipant(participant.participant_id)}>View details</DropdownMenuItem>
          <DropdownMenuItem onClick={() => rename(participant)}>Edit name</DropdownMenuItem>
          {isOwner
            ? <DropdownMenuItem onClick={() => addTransaction({ participantId: participant.participant_id, type: "savings_withdrawal" })}>Withdraw savings</DropdownMenuItem>
            : <DropdownMenuItem disabled title="Owner only">Withdraw savings (owner only)</DropdownMenuItem>}
          {isOwner
            ? <DropdownMenuItem className="text-danger" onClick={() => archive(participant)}>Archive</DropdownMenuItem>
            : <DropdownMenuItem disabled title="Owner only">Archive (owner only)</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <dl className="grid gap-2">
      <div><dt className="text-label font-bold text-muted">Total savings</dt><dd className="font-data text-xl font-bold text-ink">{formatPesos(participant.savings_centavos)}</dd></div>
      <div className="grid grid-cols-2 gap-2">
        <div><dt className="text-label font-bold text-muted">Total loans</dt><dd className="font-data font-semibold">{formatPesos(participant.loans_centavos)}</dd></div>
        <div><dt className="text-label font-bold text-muted">Balance to pay</dt><dd className="font-data font-semibold">{formatPesos(participant.balance_to_pay_centavos)}</dd></div>
      </div>
    </dl>
    <p className="text-label text-muted">Last transaction: {participant.last_transaction_date ? formatListDate(participant.last_transaction_date) : "none yet"}</p>
    <Button type="button" variant="outline" onClick={() => addTransaction({ participantId: participant.participant_id })}>Add transaction</Button>
  </Card>;
}

/** The Participants view (spec section 13): totals, two charts, and searchable, sortable participant cards. */
export function ParticipantsView() {
  const { data, params, searchParams } = useSfActions();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const needle = params.q.toLowerCase();
  const rows = sortParticipants(data.participants.filter((participant) => !needle || participant.name.toLowerCase().includes(needle)), params.psort);

  return <div className="grid gap-4">
    <ParticipantsSummary summary={data.summary} today={data.today} />
    <div className="grid items-stretch gap-4 lg:grid-cols-2">
      <SavingsDonut participants={data.participants} />
      <MonthlyBars flows={data.flows ?? []} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <div className="min-w-0 basis-64 sm:flex-1"><ListSearch pathname={pathname} searchParams={searchParams} initialValue={params.q} placeholder="Search participants" label="Search participants" /></div>
        <div className="flex items-center gap-2">
          <label className="text-label font-bold text-muted" htmlFor="sf-psort">Sort</label>
          <FilterSelect id="sf-psort" className="w-52 max-w-full" value={params.psort} onChange={(event) => startTransition(() => router.replace(listHref(pathname, searchParams, { psort: event.target.value === "savings" ? null : event.target.value }), { scroll: false }))}>
            {participantSorts.map((value) => <option key={value} value={value}>{sortLabels[value]}</option>)}
          </FilterSelect>
        </div>
      </div>
      <PrimaryActions />
    </div>
    {rows.length === 0 ? <EmptyState title={params.q ? "No participants match this search." : "No participants yet. Add your first participant."} /> :
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Participants">{rows.map((participant) => <li key={participant.participant_id}><ParticipantCard participant={participant} /></li>)}</ul>}
  </div>;
}
