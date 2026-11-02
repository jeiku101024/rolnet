"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/feedback";
import { SignedFileButton } from "@/components/forms/record-buttons";
import { getDocumentUrl } from "@/app/actions/documents";
import { documentStatusLabels, documentStatusTones } from "@/lib/documents/status";
import { fleetToday } from "@/lib/dates/fleet-date";
import { documentTypeLabels } from "@/lib/validation/documents";
import type { DetailsReverted, DetailsVersion, DocumentDetails } from "@/lib/documents/details-query";

// Feature 013 (FR-025–FR-029): one document's details, History with Restore, Reverted uploads with
// Bring back, recent Activity, and Revert upload / Close / Renew.

const day = (timestamp: string) => fleetToday(new Date(timestamp));

function Row({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-3 gap-2 py-1.5 text-body-sm"><dt className="text-muted">{label}</dt><dd className="col-span-2 min-w-0 break-words font-data text-ink">{value}</dd></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="grid gap-2 border-t border-rule pt-3"><h3 className="text-label font-bold uppercase text-muted">{title}</h3>{children}</section>;
}

export function DocumentDetailsDialog({ open, details, loading, error, onClose, onRenew, onRevert, onRestore, onBringBack }: {
  open: boolean;
  details: DocumentDetails | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRenew: () => void;
  onRevert: () => void;
  onRestore: (version: DetailsVersion) => void;
  onBringBack: (entry: DetailsReverted) => void;
}) {
  const type = details ? documentTypeLabels[details.documentType] ?? details.documentType : "Document";
  const current = details?.current ?? null;
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="max-w-xl" title={details ? `${type} · ${details.holder.name}` : "Document details"}
      description={current ? <StatusBadge label={documentStatusLabels[current.status]} tone={documentStatusTones[current.status]} /> : undefined}>
      {loading ? <p className="text-body-sm text-muted" role="status">Loading…</p> : null}
      {error ? <p className="text-body-sm text-danger" role="alert">{error}</p> : null}
      {details && !loading ? <div className="grid gap-4">
        {current ? <>
          <dl className="grid">
            <Row label="Holder" value={`${details.holder.kind === "unit" ? "Unit" : "Driver"} ${details.holder.name}`} />
            <Row label="Document number" value={current.documentNumber || "No number"} />
            <Row label="Issued on" value={current.issuedOn ?? "Not recorded"} />
            <Row label="Expiry date" value={current.expiresOn} />
            <Row label="File name" value={current.fileName} />
          </dl>
          <div><SignedFileButton load={getDocumentUrl.bind(null, current.id)} label="View file" /></div>
        </> : <p className="text-body-sm text-muted">This document was removed. Bring a reverted file back or upload a new one.</p>}

        <Section title="History">
          {details.history.length ? <ul className="grid gap-2">{details.history.map((version) => <li key={version.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0"><span className="block truncate font-data text-body-sm text-ink">{version.fileName}</span><span className="text-label text-muted">expired {version.expiresOn}</span></span>
            <span className="flex flex-wrap gap-2">
              <SignedFileButton load={getDocumentUrl.bind(null, version.id)} label="View" ariaLabel={`View ${version.fileName}`} />
              <Button type="button" variant="outline" aria-label={`Restore ${version.fileName}`} onClick={() => onRestore(version)}>Restore</Button>
            </span>
          </li>)}</ul> : <p className="text-body-sm text-muted">No previous versions.</p>}
        </Section>

        {details.reverted.length ? <Section title="Reverted uploads">
          <ul className="grid gap-2">{details.reverted.map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate font-data text-body-sm text-ink">{entry.fileName}</span>
              <span className="block text-label text-muted">Reverted {day(entry.revertedAt)} by {entry.revertedByName}</span>
              <span className="block text-label text-muted">{entry.fileKept ? `File kept until ${day(entry.keptUntil)}` : "File deleted"}</span>
            </span>
            {entry.fileKept ? <span className="flex flex-wrap gap-2">
              <SignedFileButton load={getDocumentUrl.bind(null, entry.id)} label="View" ariaLabel={`View ${entry.fileName}`} />
              <Button type="button" variant="outline" onClick={() => onBringBack(entry)}>Bring back</Button>
            </span> : null}
          </li>)}</ul>
        </Section> : null}

        <Section title="Activity">
          {details.activity.length ? <ul className="grid gap-1.5">{details.activity.map((event) => <li key={event.id} className="text-body-sm">
            <span className="text-ink">{event.summary}</span> <span className="text-muted">{day(event.occurredAt)} · {event.actorName}</span>
          </li>)}</ul> : <p className="text-body-sm text-muted">No activity yet.</p>}
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-3">
          {current?.canRevert ? <button type="button" className="touch-target px-1 text-body-sm font-semibold text-danger underline underline-offset-2" onClick={onRevert}>Revert upload</button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            <Button type="button" onClick={onRenew}>Renew</Button>
          </div>
        </div>
      </div> : null}
    </DialogContent>
  </Dialog>;
}
