"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fleetToday } from "@/lib/dates/fleet-date";
import { documentTypeLabels } from "@/lib/validation/documents";
import type { RevertedEntry } from "@/lib/documents/page-query";

const day = (timestamp: string) => fleetToday(new Date(timestamp));

/** Every revert from the last 30 days, across both panes, newest first (feature 013, FR-040). */
export function RecentlyRevertedDialog({ open, entries, onClose, onBringBack }: { open: boolean; entries: RevertedEntry[]; onClose: () => void; onBringBack: (entry: RevertedEntry) => void }) {
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent title="Recently reverted">
      {entries.length ? <ul className="grid gap-3">{entries.map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-3 last:border-b-0">
        <span className="min-w-0">
          <span className="block truncate font-data text-body-sm font-semibold text-ink">{entry.fileName}</span>
          <span className="block text-body-sm text-ink">{entry.holderName} · {documentTypeLabels[entry.documentType] ?? entry.documentType}{entry.removed ? " · document removed" : ""}</span>
          <span className="block text-label text-muted">Reverted {day(entry.revertedAt)} by {entry.revertedByName} · kept until {day(entry.keptUntil)}</span>
        </span>
        <Button type="button" variant="outline" onClick={() => onBringBack(entry)}>Bring back</Button>
      </li>)}</ul> : <p className="text-body-sm text-muted">Nothing reverted in the last 30 days.</p>}
      <p className="text-label text-muted">Older reverts no longer have a file. Each document&apos;s Activity keeps the record.</p>
    </DialogContent>
  </Dialog>;
}
