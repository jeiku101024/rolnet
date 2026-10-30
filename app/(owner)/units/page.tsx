import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UnitForm } from "@/components/forms/unit-form";
import { demoMode, demoUnits } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/feedback";
import { StatusSelect } from "@/components/forms/status-select";
import { unitStatusLabel, unitStatusTone, type UnitStatus } from "@/lib/status/record-status";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { loadListPage } from "@/lib/pagination/search-filter";
import { searchSpecs, unitStatusLabels } from "@/lib/pagination/search-specs";
import { listView } from "@/components/ui/paged-list";

export default async function UnitsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const params = await searchParams;
  const request = parseListPage(params);
  // "View all" from the dashboard's units-in-repair panel (contracts/list-paging.md fixed filters).
  const inRepairOnly = params.status === "in_repair";
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const result = supabase
    ? await loadListPage(supabase, request, searchSpecs.units, (from, to, filter) => {
      let query = supabase.from("units").select("id, body_number, plate_number, make_model, status, current_mileage", { count: "exact" }).is("deleted_at", null);
      if (inRepairOnly) query = query.eq("status", "in_repair");
      if (filter) query = query.or(filter);
      return query.order("body_number").range(from, to);
    })
    : pageRows(demoUnits.filter((unit) => !inRepairOnly || unit.status === "in_repair"), request, (unit) => `${unit.body_number} ${unit.plate_number} ${unit.make_model} ${unitStatusLabels[unit.status]}`);
  const units = result.rows;
  const list = listView("/units", params, request, result, { searchLabel: "Search units", filters: inRepairOnly ? [{ label: "Showing units in repair", param: "status" }] : [] });
  return <section className="workspace"><PageHeader eyebrow="Fleet register" title="Units" description="Keep every tricycle’s identity, status, and mileage easy to scan." /><div className="mt-8 workspace-grid"><div><DataTable list={list} headers={["Unit", "Plate", "Model", "Mileage", "Status"]} empty={<p className="p-6 text-muted">No units recorded yet.</p>}>{units.map((unit) => <tr key={unit.id}><td><Link className="muted-link" href={`/units/${unit.id}`}>Body {unit.body_number}</Link></td><td className="font-data">{unit.plate_number}</td><td>{unit.make_model}</td><td className="font-data">{unit.current_mileage.toLocaleString()} km</td><td>{isOwner ? <StatusSelect kind="unit" id={unit.id} value={unit.status as UnitStatus} label={`Status for Body ${unit.body_number}`} disabled={demoMode} /> : <StatusBadge label={unitStatusLabel(unit.status as UnitStatus)} tone={unitStatusTone(unit.status as UnitStatus)} />}</td></tr>)}</DataTable></div>{isOwner ? <aside className="border-t border-rule pt-5"><h2 className="text-section-title font-bold">Add a unit</h2><p className="mt-1 mb-4 text-body-sm text-muted">Record a new vehicle without leaving the fleet register.</p><UnitForm /></aside> : null}</div></section>;
}
