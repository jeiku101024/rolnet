import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DriverForm } from "@/components/forms/driver-form";
import { demoDrivers, demoMode } from "@/lib/demo/mode";

export default async function DriversPage() {
  await requireApprovedSession();
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const { data: drivers } = supabase ? await supabase.from("drivers").select("id, full_name, driver_kind, license_number, license_expiry_date, phone, is_active").is("deleted_at", null).order("full_name") : { data: demoDrivers };
  return <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6"><div><p className="text-sm font-medium text-blue-700">People and coverage</p><h1 className="mt-1 text-2xl font-semibold">Drivers</h1></div><DriverForm /><ul className="space-y-3">{(drivers ?? []).map((driver) => <li key={driver.id} className="rounded-lg border bg-white p-4"><Link href={`/drivers/${driver.id}`} className="block"><div className="flex items-center justify-between gap-4"><span className="font-semibold">{driver.full_name}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">{driver.driver_kind}</span></div><p className="mt-1 text-sm text-slate-600">License {driver.license_number} · expires {driver.license_expiry_date}</p><p className="text-sm text-slate-500">{driver.phone}</p></Link></li>)}</ul></section>;
}
