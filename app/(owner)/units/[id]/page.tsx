import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { fleetToday } from "@/lib/dates/fleet-date";
import { backupFor, coverageOn, type AssignmentRow, type DayOffRow } from "@/lib/assignments/coverage";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/feedback";
import { FormField, Input } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { DocumentList } from "@/components/documents/document-list";
import { StatusSelect } from "@/components/forms/status-select";
import { UnitDetailsForm } from "@/components/forms/unit-details-form";
import { LockedNotice } from "@/components/records/locked-notice";
import { StatusHistory } from "@/components/records/status-history";
import { isUnitLocked, unitStatusLabel, unitStatusTone, type UnitStatus } from "@/lib/status/record-status";
import { BackupCoverageForm, DayOffForm, EndAssignmentForm, PrimaryAssignmentForm, type DriverOption } from "@/components/forms/assignment-forms";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export default async function UnitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const { id } = await params;
  const { date: requestedDate } = await searchParams;
  const today = fleetToday();
  const date = requestedDate && datePattern.test(requestedDate) ? requestedDate : today;
  const supabase = await createSupabaseServerClient();
  const { data: unit } = await supabase.from("units").select("id, body_number, plate_number, make_model, status, current_mileage, updated_at").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!unit) notFound();
  const status = unit.status as UnitStatus;
  const locked = isUnitLocked(status);
  const [{ data: assignmentRows }, { data: driverRows }, { data: documents }] = await Promise.all([
    supabase.from("driver_assignments").select("id, assignment_type, starts_on, ends_on, driver_id, covered_primary_assignment_id, drivers(full_name)").eq("unit_id", id).is("deleted_at", null).order("starts_on", { ascending: false }),
    isOwner ? supabase.from("drivers").select("id, full_name, driver_kind, license_expiry_date").is("deleted_at", null).eq("is_active", true).gte("license_expiry_date", today).order("full_name") : Promise.resolve({ data: [] }),
    isOwner ? supabase.from("documents").select("id, document_type, expires_on, lifecycle_status, document_number").eq("unit_id", id).is("deleted_at", null).order("lifecycle_status").order("expires_on", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const assignments: AssignmentRow[] = (assignmentRows ?? []).map((a) => ({ ...a, driverName: one(a.drivers)?.full_name ?? "Unknown driver" }));
  const primaryIds = assignments.filter((a) => a.assignment_type === "primary").map((a) => a.id);
  const { data: dayOffRows } = primaryIds.length
    ? await supabase.from("driver_days_off").select("id, primary_assignment_id, day_off_date, notes").in("primary_assignment_id", primaryIds).is("deleted_at", null).order("day_off_date", { ascending: false }).limit(30)
    : { data: [] as DayOffRow[] };
  const daysOff: DayOffRow[] = dayOffRows ?? [];
  const drivers: DriverOption[] = driverRows ?? [];
  const onDate = coverageOn(date, assignments, daysOff);
  const current = coverageOn(today, assignments, daysOff).primary;
  const nameOf = (assignmentId: string) => assignments.find((a) => a.id === assignmentId)?.driverName ?? "Driver";
  const backupCandidates = (excludeId?: string) => drivers.filter((driver) => driver.id !== excludeId);

  return <section className="workspace">
    <PageHeader eyebrow="Unit history" title={`Body ${unit.body_number}`} description={`${unit.plate_number} · ${unit.make_model}`} />
    <div className="mt-8 workspace-grid">
      <div className="space-y-6 border-t border-rule pt-5">
        <div><p className="text-label font-bold uppercase text-muted">Current mileage</p><p className="mt-2 font-data text-display font-bold">{unit.current_mileage.toLocaleString()} km</p><div className="mt-4 flex flex-wrap items-center gap-3">{isOwner ? <div className="w-full sm:w-48"><StatusSelect kind="unit" id={unit.id} value={status} label={`Status for Body ${unit.body_number}`} /></div> : <StatusBadge label={unitStatusLabel(status)} tone={unitStatusTone(status)} />}<Link className="muted-link text-body-sm" href={`/maintenance/${unit.id}`}>Maintenance and mileage</Link></div>{locked ? <div className="mt-4"><LockedNotice kind="unit" status={status} /></div> : null}</div>
        <div>
          <SectionHeading title="Driver on a date" description="Who operates this unit on the chosen date." />
          <form className="mt-4 flex flex-wrap items-end gap-3" method="get"><FormField label="Date"><Input name="date" type="date" defaultValue={date} /></FormField><Button type="submit" variant="outline">Show</Button></form>
          <dl className="mt-4 grid gap-3 text-body-sm">
            <div><dt className="text-label font-bold uppercase text-muted">Operating driver</dt><dd className="mt-1 font-semibold">{onDate.operator ? onDate.operator.driverName : onDate.dayOff ? "No backup assigned" : "No driver assigned"}{onDate.backup ? " (backup)" : ""}</dd></div>
            <div><dt className="text-label font-bold uppercase text-muted">Primary driver</dt><dd className="mt-1">{onDate.primary ? `${onDate.primary.driverName} · ${onDate.primary.starts_on} → ${onDate.primary.ends_on ?? "open"}` : "None"}</dd></div>
            {onDate.dayOff ? <div><dt className="text-label font-bold uppercase text-muted">Day off</dt><dd className="mt-1"><StatusBadge label={onDate.backup ? `Covered by ${onDate.backup.driverName}` : "Needs a backup"} tone={onDate.backup ? "success" : "warning"} /></dd></div> : null}
          </dl>
        </div>
        {isOwner ? <div className="space-y-4">
          <PrimaryAssignmentForm unitId={unit.id} drivers={drivers} currentDriverName={current?.driverName} />
          {current ? <EndAssignmentForm assignmentId={current.id} startsOn={current.starts_on} driverName={current.driverName} /> : null}
          {current ? <DayOffForm assignmentId={current.id} drivers={backupCandidates(current.driver_id)} /> : null}
        </div> : null}
      </div>
      <div className="space-y-8">
        {isOwner && !locked ? <UnitDetailsForm key={unit.updated_at} unit={unit} /> : null}
        {isOwner ? <StatusHistory kind="unit" id={unit.id} /> : null}
        <div><SectionHeading title="Assignment history" /><div className="mt-4"><DataTable headers={["Driver", "Type", "Period"]} empty={<p className="p-6 text-muted">No assignments recorded yet.</p>}>{assignments.map((a) => <tr key={a.id}><td className="font-semibold"><Link className="muted-link" href={`/drivers/${a.driver_id}`}>{a.driverName}</Link></td><td className="capitalize">{a.assignment_type === "backup" ? `backup for ${a.covered_primary_assignment_id ? nameOf(a.covered_primary_assignment_id) : "day off"}` : "primary"}</td><td className="font-data">{a.assignment_type === "backup" ? a.starts_on : `${a.starts_on} → ${a.ends_on ?? "current"}`}</td></tr>)}</DataTable></div></div>
        <div><SectionHeading title="Days off and backup coverage" description="The 30 most recent days off." />
          {daysOff.length ? <ul className="mt-4 divide-y divide-rule border-y border-rule">{daysOff.map((dayOff) => { const backup = backupFor(dayOff, assignments); const primary = assignments.find((a) => a.id === dayOff.primary_assignment_id); return <li key={dayOff.id} className="grid gap-3 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-data font-semibold">{dayOff.day_off_date}</p><p className="text-body-sm text-muted">{primary?.driverName ?? "Driver"} off{dayOff.notes ? ` · ${dayOff.notes}` : ""}</p></div><StatusBadge label={backup ? `Backup: ${backup.driverName}` : "No backup"} tone={backup ? "success" : "warning"} /></div>{isOwner && !backup && dayOff.day_off_date >= today ? <BackupCoverageForm dayOffId={dayOff.id} drivers={backupCandidates(primary?.driver_id)} /> : null}</li>; })}</ul> : <p className="mt-4 border-y border-rule py-6 text-body-sm text-muted">No days off recorded.</p>}
        </div>
        {isOwner ? <div><SectionHeading title="Documents" description="OR/CR, MTOP franchise and insurance for this unit." /><div className="mt-4"><DocumentList documents={documents ?? []} emptyText="No documents for this unit yet. Upload them on the Documents page." /></div></div> : null}
      </div>
    </div>
  </section>;
}
