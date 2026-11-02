import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoMode } from "@/lib/demo/mode";
import { fleetToday, formatShortDate } from "@/lib/dates/fleet-date";
import { formatPesos } from "@/lib/money/centavos";
import { coveringAbsence, statusToday, statusTodayLabels, upcomingAbsences } from "@/lib/drivers/absences";
import { loadDriverProfile } from "@/lib/drivers/profile-query";
import { loadMoreHref, parseTabParams, tabHref, visibleTabs } from "@/lib/drivers/tab-params";
import type { SearchParams } from "@/lib/pagination/list-page";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocumentList } from "@/components/documents/document-list";
import { StatusHistory } from "@/components/records/status-history";
import { RoleTag } from "@/components/remittances/driver-tag";
import { ProfileHeader } from "@/components/drivers/profile-header";
import { RoleSwitch } from "@/components/drivers/role-switch";
import { DriverStatusControl } from "@/components/drivers/driver-status-control";
import { DriverNotices } from "@/components/drivers/driver-notices";
import { SummaryStrip } from "@/components/drivers/summary-strip";
import { DriverDetailsSection } from "@/components/drivers/driver-details-section";
import { ProfileTabs } from "@/components/drivers/profile-tabs";
import { AbsencesTable } from "@/components/drivers/absences-table";

function SimpleTable({ headers, children, empty, hasRows }: { headers: string[]; children: React.ReactNode; empty: string; hasRows: boolean }) {
  if (!hasRows) return <p className="border-y border-rule py-6 text-body-sm text-muted">{empty}</p>;
  return <Table className="data-table"><TableHeader><TableRow>{headers.map((header) => <TableHead scope="col" key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table>;
}

const longDate = (date: string) => `${formatShortDate(date)}, ${date.slice(0, 4)}`;

/**
 * Driver profile (feature 012, US5): one column with the header (role switch, Status dropdown),
 * notices, a summary strip, an inline-edit details grid, and history tabs that show 8 rows at a time.
 */
export default async function DriverDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const { id } = await params;
  const query = await searchParams;
  const today = fleetToday();
  const { tab, rows } = parseTabParams(query, isOwner);
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const data = await loadDriverProfile(supabase, id, today, tab, rows);
  if (!data) notFound();
  const { driver, absences, settings, tabRows } = data;
  const status = statusToday(driver.is_active, absences, today);
  const covering = coveringAbsence(absences, today);
  const upcoming = upcomingAbsences(absences, today);
  const pathname = `/drivers/${driver.id}`;
  const who = { id: driver.id, name: driver.full_name };

  let panel: React.ReactNode;
  if (tabRows.tab === "assignments") {
    panel = <SimpleTable headers={["Date", "Unit", "Role that day"]} hasRows={tabRows.rows.length > 0} empty="No daily assignments recorded yet.">
      {tabRows.rows.map((row) => <tr key={row.id}><td className="whitespace-nowrap font-data">{longDate(row.date)}</td><td className="font-semibold">{isOwner ? <Link className="muted-link" href={`/units/${row.unitId}`}>{row.unitName}</Link> : row.unitName}</td><td><RoleTag role={row.role} /></td></tr>)}
    </SimpleTable>;
  } else if (tabRows.tab === "remittances") {
    panel = <SimpleTable headers={["Date", "Unit", "Rental", "Paid", "Balance", "Role that day"]} hasRows={tabRows.rows.length > 0} empty="No remittances recorded yet.">
      {tabRows.rows.map((row) => <tr key={row.id} className={row.balanceCentavos > 0 ? "bg-danger-soft" : undefined}>
        <td className="whitespace-nowrap font-data">{longDate(row.date)}</td>
        <td>{row.unitName}</td>
        <td className="font-data">{formatPesos(row.rentalCentavos)}</td>
        <td className="font-data">{formatPesos(row.paidCentavos)}</td>
        <td className="font-data">{row.balanceCentavos > 0 ? <span className="font-semibold text-danger">Owes {formatPesos(row.balanceCentavos)}</span> : formatPesos(0)}</td>
        <td><RoleTag role={row.role} /></td>
      </tr>)}
    </SimpleTable>;
  } else if (tabRows.tab === "roles") {
    panel = <div className="grid gap-6">
      <SimpleTable headers={["Date", "Change", "By", "Time"]} hasRows={tabRows.rows.length > 0} empty="No role changes recorded yet. The current role applies to all past records.">
        {tabRows.rows.map((row) => <tr key={row.id}><td className="whitespace-nowrap font-data">{longDate(row.date)}</td><td className="font-semibold">{row.change}</td><td>{row.by}</td><td className="whitespace-nowrap font-data">{row.at}</td></tr>)}
      </SimpleTable>
      {isOwner && supabase ? <StatusHistory kind="driver" id={driver.id} /> : null}
    </div>;
  } else if (tabRows.tab === "absences") {
    panel = <AbsencesTable driver={who} absences={tabRows.rows} isActive={driver.is_active} settings={settings} today={today} disabled={demoMode} />;
  } else {
    panel = <DocumentList documents={tabRows.rows} emptyText="No licence document uploaded yet. Upload it on the Documents page." />;
  }

  return <section className="workspace grid gap-6">
    <ProfileHeader name={driver.full_name} phone={driver.phone} licenseNumber={driver.license_number} controls={<>
      <RoleSwitch driver={{ id: driver.id, name: driver.full_name, role: driver.driver_kind, updatedAt: driver.updated_at }} disabled={demoMode} />
      <DriverStatusControl driver={who} status={status} isOwner={isOwner} covering={covering} upcoming={upcoming} disabled={demoMode} />
    </>} />
    <DriverNotices driver={who} isActive={driver.is_active} covering={covering} upcoming={upcoming} settings={settings} today={today} disabled={demoMode} />
    <SummaryStrip todayUnit={data.todayUnit} absentOrInactive={status !== "active"} remittances30={data.remittances30} balanceCentavos={data.balanceCentavos} nextAbsence={upcoming[0]} lastAssignmentDate={data.lastAssignmentDate} />
    <DriverDetailsSection driver={driver} role={driver.driver_kind === "backup" ? "Backup" : "Primary"} status={statusTodayLabels[status]} canEdit={isOwner && driver.is_active && !demoMode} />
    <ProfileTabs tabs={visibleTabs(isOwner).map((option) => ({ value: option.value, label: option.label, href: tabHref(pathname, query, option.value) }))} active={tab} loadMoreHref={data.hasMore ? loadMoreHref(pathname, query, rows) : undefined}>
      {panel}
    </ProfileTabs>
  </section>;
}
