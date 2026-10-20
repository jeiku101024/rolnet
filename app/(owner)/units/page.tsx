import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UnitForm } from "@/components/forms/unit-form";
import { demoMode, demoUnits } from "@/lib/demo/mode";

export default async function UnitsPage() {
  await requireApprovedSession();
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const { data: units } = supabase ? await supabase.from("units").select("id, body_number, plate_number, make_model, status, current_mileage").is("deleted_at", null).order("body_number") : { data: demoUnits };
  return <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6"><div><p className="text-sm font-medium text-blue-700">Fleet register</p><h1 className="mt-1 text-2xl font-semibold">Units</h1></div><UnitForm /><ul className="space-y-3">{(units ?? []).map((unit) => <li key={unit.id} className="rounded-lg border bg-white p-4"><Link href={`/units/${unit.id}`} className="block"><div className="flex items-center justify-between gap-4"><span className="font-semibold">Body {unit.body_number}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">{unit.status.replace("_", " ")}</span></div><p className="mt-1 text-sm text-slate-600">{unit.plate_number} · {unit.make_model} · {unit.current_mileage.toLocaleString()} km</p></Link></li>)}</ul></section>;
}
