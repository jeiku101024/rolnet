import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DriverForm } from "@/components/forms/driver-form";
import { demoDrivers, demoMode } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/feedback";

export default async function DriversPage() {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const { data: drivers } = supabase ? await supabase.from("drivers").select("id, full_name, driver_kind, license_number, license_expiry_date, phone, is_active").is("deleted_at", null).order("full_name") : { data: demoDrivers };
  return <section className="workspace"><PageHeader eyebrow="People and coverage" title="Drivers" description="Review driver identity, license status, and operating coverage." /><div className="mt-8 workspace-grid"><div><DataTable headers={["Driver", "Role", "License", "Phone", "Status"]} empty={<p className="p-6 text-muted">No drivers recorded yet.</p>}>{(drivers ?? []).map((driver) => <tr key={driver.id}><td><Link className="muted-link" href={`/drivers/${driver.id}`}>{driver.full_name}</Link></td><td className="capitalize">{driver.driver_kind}</td><td className="font-data">{driver.license_number}<br /><span className="text-label text-muted">Expires {driver.license_expiry_date}</span></td><td className="font-data">{driver.phone}</td><td><StatusBadge label={driver.is_active ? "Active" : "Inactive"} tone={driver.is_active ? "success" : "muted"} /></td></tr>)}</DataTable></div>{isOwner ? <aside className="border-t border-rule pt-5"><h2 className="text-section-title font-bold">Add a driver</h2><p className="mt-1 mb-4 text-body-sm text-muted">Keep license and contact details ready for assignment.</p><DriverForm /></aside> : null}</div></section>;
}
