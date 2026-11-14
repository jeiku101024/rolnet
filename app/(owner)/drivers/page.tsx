import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoMode } from "@/lib/demo/mode";
import { fleetToday } from "@/lib/dates/fleet-date";
import { LocalTable, type LocalRow } from "@/components/ui/local-table";
import { PageHeader } from "@/components/ui/page-header";
import { finishListPage, listHref, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { controlRows, controlsView, parseControls, prepareSpec } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";
import { listView } from "@/components/ui/paged-list";
import { buildDriverRows, staleBanner, staleRows } from "@/lib/drivers/list-board";
import { loadDriverList } from "@/lib/drivers/list-query";
import { RoleTag } from "@/components/remittances/driver-tag";
import { DriverStatusBadge } from "@/components/drivers/driver-status-badge";
import { AvailabilityPreview } from "@/components/drivers/availability-preview";
import { StaleLeaveBanner } from "@/components/drivers/stale-leave-banner";
import { AddDriverDialog } from "@/components/drivers/add-driver-dialog";

/**
 * Drivers (feature 012): a full-width table with Role, today's unit, contact, and Status today derived
 * from dated absences; Role and Status today filters; the stale-leave banner; and "Available for
 * assignment" with a preview of the Units dropdown. The fleet is small, so rows are built, filtered,
 * and paged in memory (research R9).
 */
export default async function DriversPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const params = await searchParams;
  const today = fleetToday();
  const request = parseListPage(params);
  const controls = parseControls(params, prepareSpec(listControlSpecs.drivers));
  const showStale = params.stale === "1";
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const data = await loadDriverList(supabase, today);
  const rows = buildDriverRows({ ...data, today });
  const filtered = controlRows(rows, controls);
  const shownRows = showStale ? staleRows(filtered) : filtered;
  const banner = staleBanner(rows, data.settings);
  const list = listView("/drivers", params, request, finishListPage(shownRows.length, request.page), {
    searchLabel: "Search drivers",
    controls: controlsView(controls),
    emptyText: "No drivers match.",
    action: isOwner ? <AddDriverDialog /> : undefined,
    banner: banner ? <StaleLeaveBanner text={banner.text} tone={banner.tone} showHref={listHref("/drivers", params, { stale: "1", page: null })} /> : undefined,
    hint: showStale ? <>Showing stale leaves. <Link className="muted-link" href={listHref("/drivers", params, { stale: null, page: null })}>Clear</Link></> : undefined,
    aside: <AvailabilityPreview available={rows.filter((row) => row.availableToday).length} total={rows.length} today={today} />,
  });
  // The fleet is small, so every driver is sent once and the search box filters them in the browser.
  const tableRows: LocalRow[] = shownRows.map((row) => ({
    key: row.id,
    text: `${row.full_name} ${row.phone} ${row.license_number}`.toLowerCase(),
    node: <tr>
      <td className="font-semibold"><Link className="muted-link" href={`/drivers/${row.id}`}>{row.full_name}</Link></td>
      <td><RoleTag role={row.driver_kind} /></td>
      <td>{row.currentUnit ? isOwner ? <Link className="muted-link" href={`/units/${row.currentUnit.id}`}>{row.currentUnit.name}</Link> : row.currentUnit.name : <span className="text-muted">{row.unitLabel}</span>}</td>
      <td className="font-data whitespace-nowrap">{row.phone}</td>
      <td><DriverStatusBadge status={row.statusToday} line={row.statusLine} next={row.nextLine} /></td>
    </tr>,
  }));
  // A new sort, filter or stale choice brings fresh rows, so the table starts again from them.
  const resetKey = JSON.stringify([controls.values, controls.sort.value, showStale]);
  return <section className="workspace">
    <PageHeader eyebrow="People and coverage" title="Drivers" description="See who is available today, who is absent and until when, and who has an absence coming up." />
    <div className="mt-8 min-w-0">
      <LocalTable key={resetKey} list={list} headers={["Driver", "Role", "Current unit", "Contact", "Status today"]} rows={tableRows} empty={<p className="p-6 text-muted">No drivers recorded yet.</p>} />
    </div>
  </section>;
}
