"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { ListControls, ListSort } from "@/components/ui/list-controls";
import { ListSearch } from "@/components/ui/list-search";
import { listHref } from "@/lib/pagination/list-page";
import { loadMoreStep } from "@/lib/sinking-fund/url-state";
import { PrimaryActions, useSfActions } from "@/components/sinking-fund/sinking-fund-page";
import { TransactionsSummary } from "@/components/sinking-fund/summary-strip";
import { TransactionRow, rowGrid } from "@/components/sinking-fund/transaction-row";

/** The Transactions view (spec section 11): summary cards, search and filters, and every transaction in one list. */
export function TransactionsView() {
  const { data, params, searchParams } = useSfActions();
  const pathname = usePathname();
  const ledger = data.ledger ?? { rows: [], total: 0 };
  const filtered = Boolean(params.q) || data.controls.count > 0;

  return <div className="grid gap-6">
    <TransactionsSummary summary={data.summary} today={data.today} />
    {/* One card holds the toolbar and the rows, like the Expenses table (components/ui/data-table.tsx). */}
    <Card className="min-w-0"><CardContent className="data-region grid gap-4 border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-80">
          <ListControls pathname={pathname} searchParams={searchParams} controls={data.controls}
            search={<ListSearch pathname={pathname} searchParams={searchParams} initialValue={params.q} placeholder="Search participant or notes" label="Search transactions" />} />
        </div>
        <PrimaryActions />
      </div>
      {ledger.rows.length === 0 ? <EmptyState
        title={filtered ? "No transactions match these filters." : "No transactions yet. Add a participant, then record their first deposit."} /> : <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-body-sm text-muted" role="status">Showing {ledger.rows.length} of {ledger.total} transaction{ledger.total === 1 ? "" : "s"}</p>
          <ListSort pathname={pathname} searchParams={searchParams} controls={data.controls} />
        </div>
        <div>
          <div className={`hidden gap-4 border-b border-rule px-4 py-3 text-label font-bold text-muted md:grid ${rowGrid}`} aria-hidden="true">
            <span>Date</span><span>Participant</span><span>Type</span><span>Amount</span><span>Details</span><span />
          </div>
          <ul aria-label="Transactions">{ledger.rows.map((row) => <TransactionRow key={row.id} row={row} />)}</ul>
        </div>
        {ledger.total > ledger.rows.length ? <div className="flex justify-center">
          <Link className="touch-target inline-flex items-center rounded-md border border-control-border bg-surface px-4 text-body-sm font-semibold text-ink hover:bg-brand-soft" scroll={false}
            href={listHref(pathname, searchParams, { n: params.n + loadMoreStep })}>Load more</Link>
        </div> : null}
      </>}
    </CardContent></Card>
  </div>;
}
