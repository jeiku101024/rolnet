import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/feedback";
import { DocumentList } from "@/components/documents/document-list";
import { StatusSelect } from "@/components/forms/status-select";
import { DriverDetailsForm } from "@/components/forms/driver-details-form";
import { LockedNotice } from "@/components/records/locked-notice";
import { StatusHistory } from "@/components/records/status-history";
import { driverStatusOf, isDriverLocked } from "@/lib/status/record-status";

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: driver } = await supabase.from("drivers").select("id, full_name, driver_kind, license_number, license_expiry_date, phone, address, is_active, updated_at").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!driver) notFound();
  const locked = isDriverLocked(driver.is_active);
  const [{ data: assignmentRows }, { data: documents }] = await Promise.all([
    supabase.from("driver_assignments").select("id, unit_id, assignment_type, starts_on, ends_on, covered_primary_assignment_id, units(body_number, plate_number)").eq("driver_id", id).is("deleted_at", null).order("starts_on", { ascending: false }),
    isOwner ? supabase.from("documents").select("id, document_type, expires_on, lifecycle_status, document_number").eq("driver_id", id).is("deleted_at", null).order("lifecycle_status").order("expires_on", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const assignments = (assignmentRows ?? []).map((a) => ({ ...a, bodyNumber: one(a.units)?.body_number ?? "Unknown" }));
  const primaries = assignments.filter((a) => a.assignment_type === "primary");
  const backups = assignments.filter((a) => a.assignment_type === "backup");
  // Days off belong to this driver's primary assignments; the covering backups are on other drivers' rows.
  const [{ data: daysOff }, { data: coverage }] = primaries.length
    ? await Promise.all([
      supabase.from("driver_days_off").select("id, primary_assignment_id, day_off_date, notes").in("primary_assignment_id", primaries.map((a) => a.id)).is("deleted_at", null).order("day_off_date", { ascending: false }).limit(30),
      supabase.from("driver_assignments").select("id, covered_primary_assignment_id, starts_on, drivers(full_name)").eq("assignment_type", "backup").in("covered_primary_assignment_id", primaries.map((a) => a.id)).is("deleted_at", null),
    ])
    : [{ data: [] }, { data: [] }];
  const coveredBy = (dayOff: { primary_assignment_id: string; day_off_date: string }) => one((coverage ?? []).find((c) => c.covered_primary_assignment_id === dayOff.primary_assignment_id && c.starts_on === dayOff.day_off_date)?.drivers)?.full_name;
  const bodyOf = (assignmentId: string | null) => assignments.find((a) => a.id === assignmentId)?.bodyNumber;

  return <section className="workspace">
    <PageHeader eyebrow="Driver profile" title={driver.full_name} description={`${driver.driver_kind} · ${driver.phone}`} />
    <div className="mt-8 workspace-grid">
      <div className="border-t border-rule pt-5"><p className="text-label font-bold uppercase text-muted">License</p><p className="mt-2 font-data text-body font-bold">{driver.license_number}</p><p className="mt-1 text-body-sm text-muted">Expires {driver.license_expiry_date}</p>{driver.address ? <p className="mt-1 text-body-sm text-muted">{driver.address}</p> : null}<div className="mt-4">{isOwner ? <StatusSelect kind="driver" id={driver.id} value={driverStatusOf(driver.is_active)} label={`Status for ${driver.full_name}`} /> : <StatusBadge label={driver.is_active ? "Active" : "Inactive"} tone={driver.is_active ? "success" : "muted"} />}</div>{locked ? <div className="mt-4"><LockedNotice kind="driver" status="inactive" /></div> : null}</div>
      <div className="space-y-8">
        {isOwner && !locked ? <DriverDetailsForm key={driver.updated_at} driver={driver} /> : null}
        {isOwner ? <StatusHistory kind="driver" id={driver.id} /> : null}
        <div><SectionHeading title="Primary assignments" /><div className="mt-4"><DataTable searchable={false} headers={["Unit", "Period"]} empty={<p className="p-6 text-muted">No primary assignments recorded yet.</p>}>{primaries.map((a) => <tr key={a.id}><td className="font-semibold"><Link className="muted-link" href={`/units/${a.unit_id}`}>Body {a.bodyNumber}</Link></td><td className="font-data">{a.starts_on} → {a.ends_on ?? "current"}</td></tr>)}</DataTable></div></div>
        <div><SectionHeading title="Days off" description="The 30 most recent days off and who covered them." />{(daysOff ?? []).length ? <ul className="mt-4 divide-y divide-rule border-y border-rule">{(daysOff ?? []).map((dayOff) => { const backup = coveredBy(dayOff); return <li key={dayOff.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-data font-semibold">{dayOff.day_off_date}</p><p className="text-body-sm text-muted">Body {bodyOf(dayOff.primary_assignment_id) ?? "?"}{dayOff.notes ? ` · ${dayOff.notes}` : ""}</p></div><StatusBadge label={backup ? `Covered by ${backup}` : "No backup"} tone={backup ? "success" : "warning"} /></li>; })}</ul> : <p className="mt-4 border-y border-rule py-6 text-body-sm text-muted">No days off recorded.</p>}</div>
        <div><SectionHeading title="Backup coverage" description="Days this driver covered another driver's unit." /><div className="mt-4"><DataTable searchable={false} headers={["Date", "Unit"]} empty={<p className="p-6 text-muted">No backup coverage recorded.</p>}>{backups.map((a) => <tr key={a.id}><td className="font-data">{a.starts_on}</td><td><Link className="muted-link" href={`/units/${a.unit_id}`}>Body {a.bodyNumber}</Link></td></tr>)}</DataTable></div></div>
        {isOwner ? <div><SectionHeading title="License documents" /><div className="mt-4"><DocumentList documents={documents ?? []} emptyText="No license document uploaded yet. Upload it on the Documents page." /></div></div> : null}
      </div>
    </div>
  </section>;
}
