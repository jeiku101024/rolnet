import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireApprovedSession();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: unit } = await supabase.from("units").select("id, body_number, plate_number, make_model, status, current_mileage").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!unit) notFound();
  const { data: assignments } = await supabase.from("driver_assignments").select("id, assignment_type, starts_on, ends_on, drivers(full_name)").eq("unit_id", id).is("deleted_at", null).order("starts_on", { ascending: false });
  return <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6"><div><p className="text-sm font-medium text-blue-700">Unit history</p><h1 className="mt-1 text-2xl font-semibold">Body {unit.body_number}</h1><p className="mt-2 text-slate-600">{unit.plate_number} · {unit.make_model} · {unit.status.replace("_", " ")}</p></div><div className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">Current mileage</p><p className="mt-1 text-2xl font-semibold">{unit.current_mileage.toLocaleString()} km</p></div><div><h2 className="text-lg font-semibold">Assignment history</h2><ul className="mt-3 space-y-2">{(assignments ?? []).map((assignment) => <li key={assignment.id} className="rounded-lg border bg-white p-3 text-sm"><span className="font-medium">{(assignment.drivers as { full_name: string }[] | null)?.[0]?.full_name ?? "Unknown driver"}</span><span className="ml-2 capitalize text-slate-600">{assignment.assignment_type}</span><p className="text-slate-500">{assignment.starts_on} to {assignment.ends_on ?? "current"}</p></li>)}</ul></div></section>;
}
