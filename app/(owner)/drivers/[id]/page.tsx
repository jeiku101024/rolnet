import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireApprovedSession();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: driver } = await supabase.from("drivers").select("id, full_name, driver_kind, license_number, license_expiry_date, phone, address, is_active").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!driver) notFound();
  const { data: assignments } = await supabase.from("driver_assignments").select("id, assignment_type, starts_on, ends_on, units(body_number, plate_number)").eq("driver_id", id).is("deleted_at", null).order("starts_on", { ascending: false });
  return <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6"><div><p className="text-sm font-medium text-blue-700">Driver profile</p><h1 className="mt-1 text-2xl font-semibold">{driver.full_name}</h1><p className="mt-2 text-slate-600">{driver.driver_kind} · {driver.phone}</p></div><div className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">License</p><p className="mt-1 font-medium">{driver.license_number}</p><p className="text-sm text-slate-500">Expires {driver.license_expiry_date}</p></div><div><h2 className="text-lg font-semibold">Assignment history</h2><ul className="mt-3 space-y-2">{(assignments ?? []).map((assignment) => <li key={assignment.id} className="rounded-lg border bg-white p-3 text-sm"><span className="font-medium">{(assignment.units as { body_number: string; plate_number: string }[] | null)?.[0]?.body_number ?? "Unknown unit"}</span><span className="ml-2 capitalize text-slate-600">{assignment.assignment_type}</span><p className="text-slate-500">{assignment.starts_on} to {assignment.ends_on ?? "current"}</p></li>)}</ul></div></section>;
}
