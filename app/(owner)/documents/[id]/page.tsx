import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { getDocumentUrl, softDeleteDocument } from "@/app/actions/documents";
import { documentTypeLabels } from "@/lib/validation/documents";
import { ExpiryStatus } from "@/components/documents/expiry-status";
import { DocumentForm } from "@/components/forms/document-form";
import { ArchiveButton, SignedFileButton } from "@/components/forms/record-buttons";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/feedback";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { listView } from "@/components/ui/paged-list";

export default async function DocumentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requirePermission("manage_documents");
  const { id } = await params;
  const query = await searchParams;
  const s = await createSupabaseServerClient();
  const { data: doc } = await s.from("documents").select("id, document_type, document_number, issued_on, expires_on, lifecycle_status, object_path, mime_type, size_bytes, unit_id, driver_id, created_at, units(body_number, plate_number), drivers(full_name)").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!doc) notFound();
  const unit = one(doc.units);
  const driver = one(doc.drivers);
  const holderLabel = unit ? `Body ${unit.body_number}` : driver?.full_name ?? "holder";
  const holderHref = doc.unit_id ? `/units/${doc.unit_id}` : `/drivers/${doc.driver_id}`;
  let historyQuery = s.from("documents").select("id, document_number, issued_on, expires_on, lifecycle_status, created_at").eq("document_type", doc.document_type).is("deleted_at", null).order("created_at", { ascending: false });
  historyQuery = doc.unit_id ? historyQuery.eq("unit_id", doc.unit_id) : historyQuery.eq("driver_id", doc.driver_id);
  const { data: history } = await historyQuery;
  const typeLabel = documentTypeLabels[doc.document_type] ?? doc.document_type;
  const isCurrent = doc.lifecycle_status === "current";
  const historyRequest = parseListPage(query, "history_");
  const historyPage = pageRows(history ?? [], historyRequest, (item) => `${item.expires_on} ${item.document_number ?? ""} ${item.lifecycle_status}`);

  return <section className="workspace">
    <PageHeader eyebrow="Compliance register" title={typeLabel} description={`${holderLabel}${doc.document_number ? ` · ${doc.document_number}` : ""}`} />
    <div className="mt-8 workspace-grid">
      <div className="space-y-6 border-t border-rule pt-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><p className="font-data text-body">Expires {doc.expires_on}</p>{isCurrent ? <ExpiryStatus expiresOn={doc.expires_on} /> : <StatusBadge label={doc.lifecycle_status} tone="muted" />}</div>
        <dl className="grid gap-3 text-body-sm">
          <div><dt className="text-label font-bold uppercase text-muted">Holder</dt><dd className="mt-1"><Link className="muted-link" href={holderHref}>{holderLabel}</Link></dd></div>
          {doc.issued_on ? <div><dt className="text-label font-bold uppercase text-muted">Issued</dt><dd className="mt-1 font-data">{doc.issued_on}</dd></div> : null}
          <div><dt className="text-label font-bold uppercase text-muted">File</dt><dd className="mt-1">{doc.mime_type === "application/pdf" ? "PDF" : "Image"} · {Math.max(1, Math.round(doc.size_bytes / 1024)).toLocaleString()} KB</dd></div>
        </dl>
        <div className="flex flex-wrap gap-3"><SignedFileButton load={getDocumentUrl.bind(null, doc.id)} label="View or download file" /><ArchiveButton action={softDeleteDocument.bind(null, doc.id)} confirmText="Archive this document? It will no longer count as the holder's document." redirectTo="/documents" /></div>
        {isCurrent ? <DocumentForm units={[]} drivers={[]} renewal={{ documentType: doc.document_type, unitId: doc.unit_id, driverId: doc.driver_id, holderLabel }} /> : <p className="text-body-sm text-muted">This document was replaced. Open the current one from the history to renew it.</p>}
      </div>
      <div><SectionHeading title="History" description={`Every ${typeLabel} uploaded for ${holderLabel}, newest first.`} /><div className="mt-4"><DataTable list={listView(`/documents/${doc.id}`, query, historyRequest, historyPage, { searchLabel: "Search document history" })} headers={["Expires", "Number", "Status"]}>{historyPage.rows.map((item) => <tr key={item.id}><td className="font-data">{item.id === doc.id ? item.expires_on : <Link className="muted-link" href={`/documents/${item.id}`}>{item.expires_on}</Link>}</td><td>{item.document_number || "—"}</td><td>{item.lifecycle_status === "current" ? <ExpiryStatus expiresOn={item.expires_on} /> : <StatusBadge label={item.lifecycle_status} tone="muted" />}</td></tr>)}</DataTable></div></div>
    </div>
  </section>;
}
