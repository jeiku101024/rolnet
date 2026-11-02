import { ExpiryStatus } from "@/components/documents/expiry-status";
import { Highlight } from "@/components/documents/highlight";
import type { PageDocument } from "@/lib/documents/page-query";

// Feature 013 (FR-023, FR-024): driver licenses as a flat list. Inactive drivers are listed like
// everyone else.
export function DriverLicenseList({ rows, total, query, today, onOpenDocument }: { rows: PageDocument[]; total: number; query: string; today: string; onOpenDocument: (id: string) => void }) {
  if (!total) return <p className="px-2 py-6 text-center text-body-sm text-muted">No driver licenses yet.</p>;
  if (!rows.length) return <p className="px-2 py-6 text-center text-body-sm text-muted">No licenses match.</p>;
  return <ul className="grid gap-0.5" aria-label="Driver licenses">
    {rows.map((doc) => <li key={doc.id}>
      <button type="button" className="grid w-full min-w-0 gap-0.5 rounded-md px-2 py-2 text-left outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand" onClick={() => onOpenDocument(doc.id)}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-semibold text-ink"><Highlight text={doc.holderName} query={query} /></span>
          <ExpiryStatus expiresOn={doc.expiresOn} today={today} />
        </span>
        <span className="font-data text-body-sm text-muted"><Highlight text={doc.documentNumber || "No number"} query={doc.documentNumber ? query : ""} /></span>
        <span className="font-data text-body-sm text-muted">Expires <Highlight text={doc.expiresOn} query={query} /></span>
      </button>
    </li>)}
  </ul>;
}
