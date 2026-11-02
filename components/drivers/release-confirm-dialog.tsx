"use client";

import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/dates/fleet-date";

/**
 * The "Release assignments?" step (feature 012, FR-042, FR-043): lists each date and unit that will be
 * unassigned. Rows marked `kept` already have a remittance and stay assigned (Inactive only).
 */
export function ReleaseConfirm({ rows, pending, onBack, onConfirm, confirmLabel = "Release and save" }: {
  rows: { date: string; unitName: string; kept?: boolean }[];
  pending?: boolean;
  onBack: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  return <div className="grid gap-4">
    <p className="text-body-sm text-muted">These units will be unassigned on these dates. Past records are not affected.</p>
    <ul className="grid divide-y divide-rule rounded-md border border-rule">
      {rows.map((row) => <li key={`${row.date}:${row.unitName}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-body-sm">
        <span className="font-data">{formatShortDate(row.date)} · <span className="font-sans font-semibold">{row.unitName}</span></span>
        {row.kept ? <span className="text-muted">kept (remittance recorded)</span> : null}
      </li>)}
    </ul>
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" onClick={onBack} disabled={pending}>Back</Button>
      <Button type="button" onClick={onConfirm} disabled={pending}>{pending ? "Saving…" : confirmLabel}</Button>
    </div>
  </div>;
}
