import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DriverForm } from "@/components/forms/driver-form";
import { demoDrivers, demoMode } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/feedback";
import { StatusSelect } from "@/components/forms/status-select";
import { driverStatusOf } from "@/lib/status/record-status";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { loadListPage } from "@/lib/pagination/search-filter";
import { applyFilters, applySort, controlRows, controlsView, parseControls, prepareSpec } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";
import { driverKindLabels, searchSpecs } from "@/lib/pagination/search-specs";
import { listView } from "@/components/ui/paged-list";

export default async function DriversPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const params = await searchParams;
  const request = parseListPage(params);
  // Sort and filter (US8); the dashboard's "View all" opens this with kind=backup.
  const controls = parseControls(params, prepareSpec(listControlSpecs.drivers));
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const result = supabase
    ? await loadListPage(supabase, request, searchSpecs.drivers, (from, to, filter) => {
      let query = supabase.from("drivers").select("id, full_name, driver_kind, license_number, license_expiry_date, phone, is_active", { count: "exact" }).is("deleted_at", null);
      query = applyFilters(query, controls);
      if (filter) query = query.or(filter);
      return applySort(query, controls).range(from, to);
    })
    : pageRows(controlRows(demoDrivers, controls), request, (driver) => `${driver.full_name} ${driver.license_number} ${driver.phone} ${driverKindLabels[driver.driver_kind]}`);
  const drivers = result.rows;
  const list = listView("/drivers", params, request, result, { searchLabel: "Search drivers", controls: controlsView(controls) });
  return <section className="workspace"><PageHeader eyebrow="People and coverage" title="Drivers" description="Review driver identity, license status, and operating coverage." /><div className="mt-8 workspace-grid"><div><DataTable list={list} headers={["Driver", "Role", "License", "Phone", "Status"]} empty={<p className="p-6 text-muted">No drivers recorded yet.</p>}>{drivers.map((driver) => <tr key={driver.id}><td><Link className="muted-link" href={`/drivers/${driver.id}`}>{driver.full_name}</Link></td><td>{driverKindLabels[driver.driver_kind] ?? driver.driver_kind}</td><td className="font-data">{driver.license_number}<br /><span className="text-label text-muted">Expires {driver.license_expiry_date}</span></td><td className="font-data">{driver.phone}</td><td>{isOwner ? <StatusSelect kind="driver" id={driver.id} value={driverStatusOf(driver.is_active)} label={`Status for ${driver.full_name}`} disabled={demoMode} /> : <StatusBadge label={driver.is_active ? "Active" : "Inactive"} tone={driver.is_active ? "success" : "danger"} />}</td></tr>)}</DataTable></div>{isOwner ? <aside className="border-t border-rule pt-5"><h2 className="text-section-title font-bold">Add a driver</h2><p className="mt-1 mb-4 text-body-sm text-muted">Keep license and contact details ready for assignment.</p><DriverForm /></aside> : null}</div></section>;
}
