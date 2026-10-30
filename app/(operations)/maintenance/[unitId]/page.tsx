import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PartsList } from "@/components/maintenance/parts-list";
import { TireHistory, TirePositions } from "@/components/maintenance/tire-positions";
import { PartReplacementForm } from "@/components/forms/part-replacement-form";
import { TireInstallationForm } from "@/components/forms/tire-installation-form";
import { MileageForm } from "@/components/forms/mileage-form";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { PagedList, listView } from "@/components/ui/paged-list";
import { tirePositionLabels } from "@/lib/validation/maintenance";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UnitMaintenancePage({ params, searchParams }: { params: Promise<{ unitId: string }>; searchParams: Promise<SearchParams> }) {
  await requireApprovedSession();
  const { unitId } = await params;
  const query = await searchParams;
  if (!uuidPattern.test(unitId)) notFound();
  const s = await createSupabaseServerClient();
  const [{ data: unit }, { data: parts }, { data: tires }, { data: readings }] = await Promise.all([
    s.from("units").select("id, body_number, plate_number, current_mileage").eq("id", unitId).is("deleted_at", null).maybeSingle(),
    s.from("part_replacements").select("id, part_name, replaced_on, replacement_mileage, cost_centavos, next_due_date, next_due_mileage, notes").eq("unit_id", unitId).is("deleted_at", null).order("replaced_on", { ascending: false }).order("created_at", { ascending: false }),
    s.from("tire_installations").select("id, position, brand, installed_on, installed_mileage, cost_centavos, next_due_date, next_due_mileage, replaced_by_id").eq("unit_id", unitId).is("deleted_at", null).order("installed_on", { ascending: false }).order("created_at", { ascending: false }),
    s.from("mileage_readings").select("id, reading_date, mileage, notes").eq("unit_id", unitId).is("deleted_at", null).order("reading_date", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (!unit) notFound();
  const pathname = `/maintenance/${unit.id}`;
  // Each list keeps its own page and search in the URL (contracts/list-paging.md prefixes).
  const partsRequest = parseListPage(query, "parts_");
  const partsPage = pageRows(parts ?? [], partsRequest, (part) => `${part.part_name} ${part.replaced_on} ${part.notes ?? ""}`);
  const tiresRequest = parseListPage(query, "tires_");
  const tiresPage = pageRows((tires ?? []).filter((tire) => tire.replaced_by_id), tiresRequest, (tire) => `${tirePositionLabels[tire.position] ?? tire.position} ${tire.brand} ${tire.installed_on}`);
  const mileageRequest = parseListPage(query, "mileage_");
  const mileagePage = pageRows(readings ?? [], mileageRequest, () => "");
  return <section className="workspace">
    <PageHeader eyebrow="Service register" title={`Body ${unit.body_number} maintenance`} description={`${unit.plate_number} · current mileage ${unit.current_mileage.toLocaleString()} km`} />
    <p className="mt-2 flex flex-wrap gap-4 text-body-sm"><Link className="muted-link" href="/maintenance">Choose another unit</Link><Link className="muted-link" href={`/units/${unit.id}`}>Unit details</Link></p>
    <div className="mt-6 workspace-grid">
      <div className="space-y-8">
        <section><SectionHeading title="Current tires" /><div className="mt-4"><TirePositions tires={tires ?? []} /></div></section>
        <section><SectionHeading title="Parts" description="Newest replacement first." /><div className="mt-4"><PagedList list={listView(pathname, query, partsRequest, partsPage, { searchLabel: "Search parts" })} hasRows={partsPage.rows.length > 0} empty={<p className="py-6 text-body-sm text-muted">No part replacements recorded yet.</p>}><PartsList parts={partsPage.rows} /></PagedList></div></section>
        <section><SectionHeading title="Tire history" /><div className="mt-4"><PagedList list={listView(pathname, query, tiresRequest, tiresPage, { searchLabel: "Search tire history" })} hasRows={tiresPage.rows.length > 0} empty={<p className="py-6 text-body-sm text-muted">No replaced tires yet.</p>}><TireHistory tires={tiresPage.rows} /></PagedList></div></section>
        <section><SectionHeading title="Mileage readings" description="Newest first." /><div className="mt-4"><PagedList list={listView(pathname, query, mileageRequest, mileagePage, { search: false })} hasRows={mileagePage.rows.length > 0} empty={<p className="py-6 text-body-sm text-muted">No mileage readings yet.</p>}><ul className="divide-y divide-rule">{mileagePage.rows.map((reading) => <li key={reading.id} className="flex flex-wrap justify-between gap-3 py-3 text-body-sm"><span className="font-data">{reading.reading_date}</span><span className="font-data font-semibold">{reading.mileage.toLocaleString()} km{reading.notes ? <span className="font-normal text-muted"> · {reading.notes}</span> : null}</span></li>)}</ul></PagedList></div></section>
      </div>
      <div className="space-y-6 border-t border-rule pt-5">
        <MileageForm unitId={unit.id} currentMileage={unit.current_mileage} />
        <PartReplacementForm unitId={unit.id} currentMileage={unit.current_mileage} />
        <TireInstallationForm unitId={unit.id} currentMileage={unit.current_mileage} />
      </div>
    </div>
  </section>;
}
