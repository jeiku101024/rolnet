"use client";

import { usePathname } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { ListSort } from "@/components/ui/list-controls";
import { ListSearch } from "@/components/ui/list-search";
import { Pagination } from "@/components/ui/pagination";
import type { ListControlsView } from "@/lib/pagination/list-controls";
import type { SfLedgerPage } from "@/lib/sinking-fund/queries";
import { useSfActions } from "@/components/sinking-fund/sinking-fund-shell";
import { TransactionRow, rowGrid } from "@/components/sinking-fund/transaction-row";

/**
 * A participant's History (feature 021): the main Transactions list's table, search, sort, and ten-row paging, limited to
 * one participant. Page, search, and sort live in the address like the main list.
 */
export function ParticipantHistory({ history, controls, q }: { history: SfLedgerPage; controls: ListControlsView; q: string }) {
  const { searchParams } = useSfActions();
  const pathname = usePathname();
  const searching = Boolean(q);

  return <section aria-label="Transaction history" className="grid gap-3">
    <h2 className="text-section-title font-bold text-ink">History</h2>
    <Card className="min-w-0"><CardContent className="data-region grid gap-4 border-0">
      <ListSearch pathname={pathname} searchParams={searchParams} initialValue={q} placeholder="Search notes" label="Search history" />
      {history.rows.length === 0 ? <EmptyState title={searching ? "No transactions match this search." : "No transactions yet."} /> : <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-body-sm text-muted" role="status">{history.total} transaction{history.total === 1 ? "" : "s"}</p>
          <ListSort pathname={pathname} searchParams={searchParams} controls={controls} />
        </div>
        <div>
          <div className={`hidden gap-4 border-b border-rule px-4 py-3 text-label font-bold text-muted md:grid ${rowGrid}`} aria-hidden="true">
            <span>Date</span><span>Participant</span><span>Type</span><span>Amount</span><span>Details</span><span />
          </div>
          <ul aria-label="History" data-testid="sf-detail-history">{history.rows.map((row) => <TransactionRow key={row.id} row={row} />)}</ul>
        </div>
        <Pagination pathname={pathname} searchParams={searchParams} state={history} />
      </>}
    </CardContent></Card>
  </section>;
}
