import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState, StatusBadge } from "@/components/ui/feedback";
import { demoDueMaintenance, demoMode, demoUnits } from "@/lib/demo/mode";
import { fleetToday } from "@/lib/dates/fleet-date";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { loadListPage } from "@/lib/pagination/search-filter";
import { activeValue, applyFilters, applySort, controlRows, controlsView, parseControls, prepareSpec } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";
import { searchSpecs, unitStatusLabels } from "@/lib/pagination/search-specs";
import { listView } from "@/components/ui/paged-list";

/** Unit picker: choose the unit, then record mileage, parts and tires on its page (T140). */
export default async function MaintenancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const params = await searchParams;
  const request = parseListPage(params);
  // Sort and filter (US8). "Has maintenance due" (the dashboard's "View all") is owner-only:
  // due_maintenance() returns rows only for owners.
  const controls = parseControls(params, prepareSpec(listControlSpecs.maintenance, { isOwner: profile.role === "owner" }));
  const dueOnly = activeValue(controls, "due") === "1";
  const s = demoMode ? null : await createSupabaseServerClient();
  const dueUnitIds = dueOnly ? [...new Set((s ? (await s.rpc("due_maintenance", { as_of: fleetToday() })).data ?? [] : demoDueMaintenance).map((row: { unit_id: string }) => row.unit_id))] : [];
  const result = s
    ? await loadListPage(s, request, searchSpecs.maintenanceUnits, (from, to, filter) => {
      let query = s.from("units").select("id, body_number, plate_number, status, current_mileage", { count: "exact" }).is("deleted_at", null);
      if (dueOnly) query = query.in("id", dueUnitIds);
      query = applyFilters(query, controls);
      if (filter) query = query.or(filter);
      return applySort(query, controls).range(from, to);
    })
    : pageRows(controlRows(demoUnits.filter((unit) => !dueOnly || dueUnitIds.includes(unit.id)), controls), request, (unit) => `${unit.body_number} ${unit.plate_number}`);
  const units = result.rows;
  const list = listView("/maintenance", params, request, result, { searchLabel: "Search units", controls: controlsView(controls) });
  return <section className="workspace"><PageHeader eyebrow="Service register" title="Maintenance" description="Choose a unit to record mileage, part replacements and tires, and to see its service history." />
    <div className="mt-8">{units.length || request.q || controls.count ? <DataTable list={list} headers={["Unit", "Plate", "Mileage", "Status"]}>{units.map((unit) => <tr key={unit.id}><td><Link className="muted-link font-semibold" href={`/maintenance/${unit.id}`}>Body {unit.body_number}</Link></td><td className="font-data">{unit.plate_number}</td><td className="font-data">{unit.current_mileage.toLocaleString()} km</td><td><StatusBadge label={unitStatusLabels[unit.status] ?? unit.status} tone={unit.status === "active" ? "success" : unit.status === "in_repair" ? "warning" : "danger"} /></td></tr>)}</DataTable> : <EmptyState title="No active units yet." description="Add a unit before recording maintenance." />}</div>
  </section>;
}
