"use client";

import { History } from "lucide-react";
import { FilterSelect } from "@/components/ui/list-controls";
import { documentSorts, type DocumentSort } from "@/lib/documents/url-state";

const toolButton = "touch-target inline-flex shrink-0 items-center gap-2 rounded-md border border-control-border bg-surface px-3 text-body-sm font-semibold text-ink hover:bg-brand-soft";

/** "Recently reverted" with its count, then the Sort shared by both panes (feature 013, FR-001, FR-008). */
export function DocumentsHeaderActions({ revertedCount, onOpenReverted, sort, onSort }: { revertedCount: number; onOpenReverted: () => void; sort: DocumentSort; onSort: (sort: DocumentSort) => void }) {
  return <>
    <button type="button" className={toolButton} onClick={onOpenReverted} aria-label={`Recently reverted (${revertedCount})`}>
      <History aria-hidden="true" size={16} />Recently reverted
      <span className="rounded-sm bg-brand-soft px-1.5 font-data text-label font-bold text-brand-dark">{revertedCount}</span>
    </button>
    <label className="grid min-w-0 flex-1 basis-48 gap-1 text-label font-bold text-muted sm:flex-none">
      Sort (both panes)
      <FilterSelect value={sort} onChange={(event) => onSort(event.target.value as DocumentSort)} className="w-full sm:w-52">
        {documentSorts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </FilterSelect>
    </label>
  </>;
}
