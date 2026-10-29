import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { DocumentForm } from "@/components/forms/document-form";
import { DocumentList, type DocumentRow } from "@/components/documents/document-list";
import { demoDocuments, demoDrivers, demoMode, demoUnits } from "@/lib/demo/mode";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/feedback";

type Doc = DocumentRow & { unit_id: string | null; driver_id: string | null; units?: unknown; drivers?: unknown };
type Group = { key: string; href: string; label: string; documents: Doc[] };

function groupBy(docs: Doc[], holder: "unit" | "driver") {
  const groups = new Map<string, Group>();
  for (const doc of docs) {
    const id = holder === "unit" ? doc.unit_id : doc.driver_id;
    if (!id) continue;
    const label = holder === "unit" ? `Body ${one(doc.units as { body_number: string } | null)?.body_number ?? "?"}` : one(doc.drivers as { full_name: string } | null)?.full_name ?? "Driver";
    const group = groups.get(id) ?? { key: id, href: holder === "unit" ? `/units/${id}` : `/drivers/${id}`, label, documents: [] };
    group.documents.push(doc);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function Groups({ title, groups, empty }: { title: string; groups: Group[]; empty: string }) {
  return <div><SectionHeading title={title} />{groups.length ? <div className="mt-4 space-y-5">{groups.map((group) => <div key={group.key}><Link className="muted-link text-body font-semibold" href={group.href}>{group.label}</Link><div className="mt-2"><DocumentList documents={group.documents} emptyText="" /></div></div>)}</div> : <p className="mt-4 border-y border-rule py-6 text-body-sm text-muted">{empty}</p>}</div>;
}

export default async function DocumentsPage() {
  await requirePermission("manage_documents");
  const s = demoMode ? null : await createSupabaseServerClient();
  const [{ data: docs }, { data: units }, { data: drivers }] = s ? await Promise.all([
    s.from("documents").select("id, document_type, document_number, expires_on, lifecycle_status, unit_id, driver_id, units(body_number), drivers(full_name)").is("deleted_at", null).eq("lifecycle_status", "current").order("expires_on"),
    s.from("units").select("id, body_number, plate_number").is("deleted_at", null).order("body_number"),
    s.from("drivers").select("id, full_name, license_expiry_date").is("deleted_at", null).order("full_name"),
  ]) : [{ data: demoDocuments.map((d) => ({ ...d, unit_id: demoUnits[0].id, driver_id: null, units: { body_number: demoUnits[0].body_number } })) }, { data: demoUnits }, { data: demoDrivers }];
  const current = (docs ?? []) as Doc[];
  return <section className="workspace"><PageHeader eyebrow="Compliance register" title="Documents" description="Current OR/CR, MTOP franchise and insurance by unit, and licenses by driver. Open a document to see its history or renew it." />
    <div className="mt-8 workspace-grid">
      <div className="space-y-8">{current.length ? <><Groups title="Units" groups={groupBy(current, "unit")} empty="No unit documents yet." /><Groups title="Drivers" groups={groupBy(current, "driver")} empty="No driver licenses uploaded yet." /></> : <EmptyState title="No compliance documents recorded yet." description="Upload the first OR/CR, franchise, insurance or license file." />}</div>
      <aside className="border-t border-rule pt-5"><h2 className="text-section-title font-bold">Upload document</h2><p className="mt-1 mb-4 text-body-sm text-muted">Uploading a type the holder already has renews it; the previous file stays in the history.</p><DocumentForm units={units ?? []} drivers={drivers ?? []} /></aside>
    </div>
  </section>;
}
