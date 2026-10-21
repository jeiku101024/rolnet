import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/feedback";

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireApprovedSession(); const { id } = await params; const supabase = await createSupabaseServerClient();
  const { data: driver } = await supabase.from("drivers").select("id, full_name, driver_kind, license_number, license_expiry_date, phone, address, is_active").eq("id", id).is("deleted_at", null).maybeSingle(); if (!driver) notFound();
  const { data: assignments } = await supabase.from("driver_assignments").select("id, assignment_type, starts_on, ends_on, units(body_number, plate_number)").eq("driver_id", id).is("deleted_at", null).order("starts_on", { ascending: false });
  return <section className="workspace"><PageHeader eyebrow="Driver profile" title={driver.full_name} description={`${driver.driver_kind} · ${driver.phone}`} /><div className="mt-8 workspace-grid"><div className="border-t border-rule pt-5"><p className="text-label font-bold uppercase text-muted">License</p><p className="mt-2 font-data text-body font-bold">{driver.license_number}</p><p className="mt-1 text-body-sm text-muted">Expires {driver.license_expiry_date}</p><div className="mt-4"><StatusBadge label={driver.is_active ? "Active" : "Inactive"} tone={driver.is_active ? "success" : "muted"} /></div></div><div><SectionHeading title="Assignment history" /><div className="mt-4"><DataTable headers={["Unit", "Type", "Period"]} empty={<p className="p-6 text-muted">No assignments recorded yet.</p>}>{(assignments ?? []).map((a) => <tr key={a.id}><td className="font-semibold">Body {(a.units as { body_number: string }[] | null)?.[0]?.body_number ?? "Unknown"}</td><td className="capitalize">{a.assignment_type}</td><td className="font-data">{a.starts_on} → {a.ends_on ?? "current"}</td></tr>)}</DataTable></div></div></div></section>;
}
