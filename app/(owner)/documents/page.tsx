import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DocumentForm } from "@/components/forms/document-form";
import { ExpiryStatus } from "@/components/documents/expiry-status";
import { demoDocuments, demoDrivers, demoMode, demoUnits } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

export default async function DocumentsPage() {
  await requirePermission("manage_documents");
  const s = demoMode ? null : await createSupabaseServerClient();
  const [{ data: docs }, { data: units }, { data: drivers }] = s ? await Promise.all([s.from("documents").select("id,document_type,expires_on,object_path,lifecycle_status").is("deleted_at", null).order("expires_on"), s.from("units").select("id,body_number,plate_number").is("deleted_at", null).order("body_number"), s.from("drivers").select("id,full_name,license_expiry_date").is("deleted_at", null).order("full_name")]) : [{ data: demoDocuments }, { data: demoUnits }, { data: demoDrivers }];
  return <section className="workspace"><PageHeader eyebrow="Compliance register" title="Documents" description="Keep OR/CR, licenses, franchise, and insurance records current." /><div className="mt-8 workspace-grid"><div><DataTable headers={["Document", "Expires", "Status", "File"]} empty={<p className="p-6 text-muted">No compliance documents recorded yet.</p>}>{(docs ?? []).map((d) => <tr key={d.id}><td className="font-semibold capitalize">{d.document_type.replace("_", " ")}</td><td className="font-data">{d.expires_on}</td><td><ExpiryStatus expiresOn={d.expires_on} /></td><td className="text-body-sm text-muted">{d.object_path ? "Uploaded" : "Missing"}</td></tr>)}</DataTable></div><aside className="border-t border-rule pt-5"><h2 className="text-section-title font-bold">Upload document</h2><p className="mt-1 mb-4 text-body-sm text-muted">Attach the current file and keep its expiry date queryable.</p><DocumentForm units={units ?? []} drivers={drivers ?? []} /></aside></div></section>;
}
