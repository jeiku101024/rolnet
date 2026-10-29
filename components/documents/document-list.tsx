import Link from "next/link";
import { ExpiryStatus } from "@/components/documents/expiry-status";
import { StatusBadge } from "@/components/ui/feedback";
import { documentTypeLabels } from "@/lib/validation/documents";

export type DocumentRow = { id: string; document_type: string; expires_on: string; lifecycle_status: string; document_number?: string | null };

/** Compact document list for unit and driver detail pages (FR-024). */
export function DocumentList({ documents, emptyText }: { documents: DocumentRow[]; emptyText: string }) {
  if (!documents.length) return <p className="border-y border-rule py-6 text-body-sm text-muted">{emptyText}</p>;
  return <ul className="divide-y divide-rule border-y border-rule">{documents.map((doc) => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
    <div className="min-w-0"><Link className="muted-link font-semibold" href={`/documents/${doc.id}`}>{documentTypeLabels[doc.document_type] ?? doc.document_type}</Link><p className="font-data text-body-sm text-muted">{doc.document_number ? `${doc.document_number} · ` : ""}Expires {doc.expires_on}</p></div>
    {doc.lifecycle_status === "current" ? <ExpiryStatus expiresOn={doc.expires_on} /> : <StatusBadge label={doc.lifecycle_status} tone="muted" />}
  </li>)}</ul>;
}
