import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { fleetToday } from "@/lib/dates/fleet-date";
import { currentDrivers, type CurrentDriver, type UnitAssignmentRow } from "@/lib/assignments/current-drivers";
import type { DayOffRow } from "@/lib/assignments/coverage";
import { UnitForm } from "@/components/forms/unit-form";
import { demoMode, demoUnitAssignments, demoUnitDaysOff, demoUnits } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/feedback";
import { StatusSelect } from "@/components/forms/status-select";
import { unitStatusLabel, unitStatusTone, type UnitStatus } from "@/lib/status/record-status";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { loadListPage } from "@/lib/pagination/search-filter";
import { applyFilters, applySort, controlRows, controlsView, parseControls, prepareSpec } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";
import { searchSpecs, unitStatusLabels } from "@/lib/pagination/search-specs";
import { listView } from "@/components/ui/paged-list";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Today's assignments and days off for one page of units (feature 007, research R4). An
 * assignment whose driver is archived comes back without a name (drivers RLS hides deleted rows),
 * so it is dropped and the unit reads as unassigned.
 */
async function loadCoverage(supabase: Supabase, unitIds: string[], today: string) {
  if (!unitIds.length) return { assignments: [] as UnitAssignmentRow[], daysOff: [] as DayOffRow[] };
  const { data: rows, error } = await supabase.from("driver_assignments").select("id, unit_id, assignment_type, starts_on, ends_on, driver_id, covered_primary_assignment_id, drivers(full_name)").in("unit_id", unitIds).is("deleted_at", null).lte("starts_on", today).or(`ends_on.is.null,ends_on.gte.${today}`);
  if (error) throw error;
  const assignments: UnitAssignmentRow[] = (rows ?? []).flatMap(({ drivers, ...row }) => {
    const driver = one(drivers as { full_name: string } | { full_name: string }[] | null);
    return driver ? [{ ...row, driverName: driver.full_name }] : [];
  });
  const primaryIds = assignments.filter((a) => a.assignment_type === "primary").map((a) => a.id);
  if (!primaryIds.length) return { assignments, daysOff: [] as DayOffRow[] };
  const { data: daysOff, error: daysOffError } = await supabase.from("driver_days_off").select("id, primary_assignment_id, day_off_date, notes").in("primary_assignment_id", primaryIds).eq("day_off_date", today).is("deleted_at", null);
  if (daysOffError) throw daysOffError;
  return { assignments, daysOff: (daysOff ?? []) as DayOffRow[] };
}

function CurrentDriverCell({ driver }: { driver?: CurrentDriver }) {
  if (!driver || driver.kind === "unassigned") return <span className="text-muted">Unassigned</span>;
  if (driver.kind === "day-off") return <StatusBadge label="Day off · no backup" tone="warning" />;
  return <span className="inline-flex flex-wrap items-center gap-2"><Link className="muted-link" href={`/drivers/${driver.driverId}`}>{driver.driverName}</Link>{driver.kind === "backup" ? <StatusBadge label="Backup" /> : null}</span>;
}

export default async function UnitsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const params = await searchParams;
  const request = parseListPage(params);
  const today = fleetToday();
  // Sort and filter (US8); the dashboard's "View all" opens this with status=in_repair.
  const controls = parseControls(params, prepareSpec(listControlSpecs.units));
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const result = supabase
    ? await loadListPage(supabase, request, searchSpecs.units, (from, to, filter) => {
      let query = supabase.from("units").select("id, name, body_number, plate_number, make_model, status, current_mileage", { count: "exact" }).is("deleted_at", null);
      query = applyFilters(query, controls);
      if (filter) query = query.or(filter);
      return applySort(query, controls).range(from, to);
    })
    : pageRows(controlRows(demoUnits, controls), request, (unit) => `${unit.name} ${unit.body_number} ${unit.plate_number} ${unit.make_model} ${unitStatusLabels[unit.status]}`);
  const units = result.rows;
  const unitIds = units.map((unit) => unit.id);
  const coverage = supabase ? await loadCoverage(supabase, unitIds, today) : { assignments: demoUnitAssignments, daysOff: demoUnitDaysOff };
  const drivers = currentDrivers(unitIds, coverage.assignments, coverage.daysOff, today);
  const list = listView("/units", params, request, result, { searchLabel: "Search units", controls: controlsView(controls) });
  return <section className="workspace"><PageHeader eyebrow="Fleet register" title="Units" description="Keep every tricycle’s identity, status, and mileage easy to scan." /><div className="mt-8 workspace-grid"><div><DataTable list={list} headers={["Unit", "Body number", "Plate", "Motorcycle", "Current driver", "Mileage", "Status"]} empty={<p className="p-6 text-muted">No units recorded yet.</p>}>{units.map((unit) => <tr key={unit.id}><td className="whitespace-nowrap font-semibold"><Link className="muted-link" href={`/units/${unit.id}`}>{unit.name}</Link></td><td className="whitespace-nowrap font-data">{unit.body_number}</td><td className="font-data">{unit.plate_number}</td><td>{unit.make_model}</td><td><CurrentDriverCell driver={drivers.get(unit.id)} /></td><td className="font-data">{unit.current_mileage.toLocaleString()} km</td><td>{isOwner ? <StatusSelect kind="unit" id={unit.id} value={unit.status as UnitStatus} label={`Status for ${unit.name}`} disabled={demoMode} /> : <StatusBadge label={unitStatusLabel(unit.status as UnitStatus)} tone={unitStatusTone(unit.status as UnitStatus)} />}</td></tr>)}</DataTable></div>{isOwner ? <aside className="border-t border-rule pt-5"><h2 className="text-section-title font-bold">Add a unit</h2><p className="mt-1 mb-4 text-body-sm text-muted">Record a new vehicle without leaving the fleet register.</p><UnitForm /></aside> : null}</div></section>;
}
