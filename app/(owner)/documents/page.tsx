import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { DocumentForm } from "@/components/forms/document-form";
import { DocumentList, type DocumentRow } from "@/components/documents/document-list";
import { demoDocuments, demoDrivers, demoMode, demoUnits } from "@/lib/demo/mode";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { loadListPage } from "@/lib/pagination/search-filter";
import { applyFilters, applySort, controlRows, controlsView, parseControls, prepareSpec } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";
import { searchSpecs } from "@/lib/pagination/search-specs";
import { documentTypeLabels } from "@/lib/validation/documents";
import { PagedList, listView } from "@/components/ui/paged-list";

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

function Groups({ title, groups }: { title: string; groups: Group[] }) {
  if (!groups.length) return null;
  return <div><h2 className="text-label font-bold uppercase text-muted">{title}</h2><div className="mt-3 space-y-5">{groups.map((group) => <div key={group.key}><Link className="muted-link text-body font-semibold" href={group.href}>{group.label}</Link><div className="mt-2"><DocumentList documents={group.documents} emptyText="" /></div></div>)}</div></div>;
}

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("manage_documents");
  const params = await searchParams;
  const request = parseListPage(params);
  // Sort and filter (US8); the dashboard's "View all" opens this with expiry=due.
  const controls = parseControls(params, prepareSpec(listControlSpecs.documents));
  const s = demoMode ? null : await createSupabaseServerClient();
  const demoDocs = demoDocuments.map((d) => ({ ...d, units: d.unit_id ? { body_number: demoUnits.find((unit) => unit.id === d.unit_id)?.body_number ?? "?" } : null, drivers: d.driver_id ? { full_name: demoDrivers.find((driver) => driver.id === d.driver_id)?.full_name ?? "Driver" } : null }));
  const [result, { data: units }, { data: drivers }] = s ? await Promise.all([
    loadListPage(s, request, searchSpecs.documents, (from, to, filter) => {
      let query = s.from("documents").select("id, document_type, document_number, expires_on, lifecycle_status, unit_id, driver_id, units(body_number), drivers(full_name)", { count: "exact" }).is("deleted_at", null).eq("lifecycle_status", "current");
      query = applyFilters(query, controls);
      if (filter) query = query.or(filter);
      return applySort(query, controls).range(from, to);
    }),
    s.from("units").select("id, body_number, plate_number").is("deleted_at", null).order("body_number"),
    s.from("drivers").select("id, full_name, license_expiry_date").is("deleted_at", null).order("full_name"),
  ]) : [pageRows(controlRows(demoDocs, controls), request, (d) => `${documentTypeLabels[d.document_type]} ${d.document_number} ${d.units?.body_number ?? ""} ${d.drivers?.full_name ?? ""} ${d.expires_on}`), { data: demoUnits }, { data: demoDrivers }];
  const current = result.rows as Doc[];
  const list = listView("/documents", params, request, result, { searchLabel: "Search documents", controls: controlsView(controls) });
  return <section className="workspace"><PageHeader eyebrow="Compliance register" title="Documents" description="Current OR/CR, MTOP franchise and insurance by unit, and licenses by driver, soonest expiry first. Open a document to see its history or renew it." />
    <div className="mt-8 workspace-grid">
      <div><SectionHeading title="Current documents" /><div className="mt-4"><PagedList list={list} hasRows={current.length > 0} empty={<EmptyState title="No compliance documents recorded yet." description="Upload the first OR/CR, franchise, insurance or license file." />}><div className="space-y-6 pt-2"><Groups title="Units" groups={groupBy(current, "unit")} /><Groups title="Drivers" groups={groupBy(current, "driver")} /></div></PagedList></div></div>
      <aside className="border-t border-rule pt-5"><h2 className="text-section-title font-bold">Upload document</h2><p className="mt-1 mb-4 text-body-sm text-muted">Uploading a type the holder already has renews it; the previous file stays in the history.</p><DocumentForm units={units ?? []} drivers={drivers ?? []} /></aside>
    </div>
  </section>;
}
