import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/feedback";

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireApprovedSession(); const { id } = await params; const supabase = await createSupabaseServerClient();
  const { data: unit } = await supabase.from("units").select("id, body_number, plate_number, make_model, status, current_mileage").eq("id", id).is("deleted_at", null).maybeSingle(); if (!unit) notFound();
  const { data: assignments } = await supabase.from("driver_assignments").select("id, assignment_type, starts_on, ends_on, drivers(full_name)").eq("unit_id", id).is("deleted_at", null).order("starts_on", { ascending: false });
  return <section className="workspace"><PageHeader eyebrow="Unit history" title={`Body ${unit.body_number}`} description={`${unit.plate_number} · ${unit.make_model}`} /><div className="mt-8 workspace-grid"><div className="border-t border-rule pt-5"><p className="text-label font-bold uppercase text-muted">Current mileage</p><p className="mt-2 font-data text-display font-bold">{unit.current_mileage.toLocaleString()} km</p><div className="mt-4"><StatusBadge label={unit.status.replace("_", " ")} tone={unit.status === "active" ? "success" : unit.status === "in_repair" ? "warning" : "danger"} /></div></div><div><SectionHeading title="Assignment history" /><div className="mt-4"><DataTable headers={["Driver", "Type", "Period"]} empty={<p className="p-6 text-muted">No assignments recorded yet.</p>}>{(assignments ?? []).map((a) => <tr key={a.id}><td className="font-semibold">{(a.drivers as { full_name: string }[] | null)?.[0]?.full_name ?? "Unknown driver"}</td><td className="capitalize">{a.assignment_type}</td><td className="font-data">{a.starts_on} → {a.ends_on ?? "current"}</td></tr>)}</DataTable></div></div></div></section>;
}
