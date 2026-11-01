import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fleetToday } from "@/lib/dates/fleet-date";
import { currentDriversOn, type TodayDriver } from "@/lib/assignments/current-drivers";
import { demoMode, demoUnits } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/feedback";
import { unitStatusLabel, unitStatusTone, type UnitStatus } from "@/lib/status/record-status";
import { listHref, pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { loadListPage } from "@/lib/pagination/search-filter";
import { applyFilters, applySort, controlRows, controlsView, parseControls, prepareSpec } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";
import { searchSpecs, unitStatusLabels } from "@/lib/pagination/search-specs";
import { listView } from "@/components/ui/paged-list";
import { parseUnitsView } from "@/lib/units/view-params";
import { buildAssignmentBoard, roleLabel } from "@/lib/units/assignment-board";
import { loadAssignmentRows } from "@/lib/units/assignment-query";
import { UnitsViewToggle } from "@/components/units/units-view-toggle";
import { AssignmentView } from "@/components/units/assignment-view";
import { AddUnitDialog } from "@/components/units/add-unit-dialog";
import { UnitRowMenu } from "@/components/units/unit-row-menu";
import { ShowArchivedToggle } from "@/components/units/show-archived-toggle";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function CurrentDriverCell({ driver }: { driver?: TodayDriver }) {
  if (!driver) return <span className="text-muted">Unassigned</span>;
  return <span className="inline-flex flex-wrap items-center gap-2"><Link className="muted-link" href={`/drivers/${driver.driverId}`}>{driver.driverName}</Link>{driver.role === "backup" ? <StatusBadge label={roleLabel(driver.role)} /> : null}</span>;
}

/**
 * Units (feature 010): List view (owner) and the Daily assignment view (owner and staff), switched
 * by `?view=` without a reload (FR-001). Staff always get the Daily assignment view (FR-056).
 */
export default async function UnitsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const params = await searchParams;
  const today = fleetToday();
  const { view, date } = parseUnitsView(params, today, isOwner);
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const header = <PageHeader eyebrow="Fleet register" title="Units" description="Keep every tricycle’s identity, status, and mileage easy to scan." action={isOwner ? <UnitsViewToggle view={view} /> : undefined} />;

  if (view === "daily") {
    const board = buildAssignmentBoard({ date, today, rows: await loadAssignmentRows(supabase, date, today) });
    return <section className="workspace">{header}<div className="mt-8 min-w-0"><AssignmentView key={board.date} board={board} isOwner={isOwner} /></div></section>;
  }
  return <section className="workspace">{header}<div className="mt-8 min-w-0"><UnitsList supabase={supabase} params={params} today={today} /></div></section>;
}

async function UnitsList({ supabase, params, today }: { supabase: Supabase | null; params: SearchParams; today: string }) {
  const request = parseListPage(params);
  const showArchived = params.archived === "1";
  // Sort and filter (US8); the dashboard's "View all" opens this with status=in_repair.
  const controls = parseControls(params, prepareSpec(listControlSpecs.units));
  const [result, archivedCount] = await Promise.all([
    supabase
      ? loadListPage(supabase, request, searchSpecs.units, (from, to, filter) => {
        let query = supabase.from("units").select("id, name, body_number, plate_number, make_model, status, current_mileage, archived, updated_at", { count: "exact" }).is("deleted_at", null);
        if (!showArchived) query = query.eq("archived", false);
        query = applyFilters(query, controls);
        if (filter) query = query.or(filter);
        return applySort(query, controls).range(from, to);
      })
      : Promise.resolve(pageRows(controlRows(demoUnits.filter((unit) => showArchived || !unit.archived).map((unit) => ({ ...unit, updated_at: unit.created_at })), controls), request, (unit) => `${unit.name} ${unit.body_number} ${unit.plate_number} ${unit.make_model} ${unitStatusLabels[unit.status]}`)),
    supabase
      ? supabase.from("units").select("id", { count: "exact", head: true }).eq("archived", true).is("deleted_at", null).then(({ count, error }) => { if (error) throw error; return count ?? 0; })
      : Promise.resolve(demoUnits.filter((unit) => unit.archived).length),
  ]);
  const units = result.rows;
  const drivers = await currentDriversOn(supabase, units.map((unit) => unit.id), today);
  const toggleHref = listHref("/units", params, { archived: showArchived ? null : "1", page: null });
  const list = listView("/units", params, request, result, {
    searchLabel: "Search units", controls: controlsView(controls),
    action: <AddUnitDialog />,
    aside: <ShowArchivedToggle checked={showArchived} count={archivedCount} href={toggleHref} />,
  });
  return <DataTable list={list} headers={["Unit", "Body number", "Plate", "Motorcycle", "Current driver", "Mileage", "Status", "Options"]} empty={<p className="p-6 text-muted">No units recorded yet.</p>}>
    {units.map((unit) => <tr key={unit.id} className={unit.archived ? "opacity-60" : undefined}>
      <td className="whitespace-nowrap font-semibold"><span className="inline-flex items-center gap-2"><Link className="muted-link" href={`/units/${unit.id}`}>{unit.name}</Link>{unit.archived ? <StatusBadge label="Archived" /> : null}</span></td>
      <td className="whitespace-nowrap font-data">{unit.body_number}</td>
      <td className="font-data">{unit.plate_number}</td>
      <td>{unit.make_model}</td>
      <td><CurrentDriverCell driver={drivers.get(unit.id)} /></td>
      <td className="whitespace-nowrap font-data">{unit.current_mileage.toLocaleString()} km</td>
      <td><StatusBadge label={unitStatusLabel(unit.status as UnitStatus)} tone={unitStatusTone(unit.status as UnitStatus)} /></td>
      <td><UnitRowMenu unit={{ id: unit.id, name: unit.name, updatedAt: unit.updated_at, archived: unit.archived }} /></td>
    </tr>)}
  </DataTable>;
}
