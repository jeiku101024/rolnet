import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPesos } from "@/lib/money/centavos";
import { RemittanceForm } from "@/components/forms/remittance-form";
import { demoAssignments, demoMode, demoRemittances } from "@/lib/demo/mode";

export default async function RemittancesPage() {
  await requireApprovedSession();
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const [{ data: assignments }, { data: remittances }] = supabase ? await Promise.all([
    supabase.from("driver_assignments").select("id, starts_on, ends_on, units(body_number), drivers(full_name)").is("deleted_at", null).order("starts_on", { ascending: false }),
    supabase.from("remittances").select("id, service_date, disposition, amount_due_centavos, notes, updated_at, units(body_number), drivers(full_name), remittance_payments(amount_centavos)").is("deleted_at", null).order("service_date", { ascending: false }).limit(50),
  ]) : [{ data: demoAssignments }, { data: demoRemittances }];
  return <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6"><div><p className="text-sm font-medium text-blue-700">Daily income</p><h1 className="mt-1 text-2xl font-semibold">Remittances</h1><p className="mt-2 text-sm text-slate-600">Returned units are ₱180. Bring-home/overtime days are ₱300 total.</p></div><RemittanceForm assignments={(assignments ?? []) as never[]} /><div><h2 className="text-lg font-semibold">Recent remittances</h2><ul className="mt-3 space-y-3">{(remittances ?? []).map((remittance) => { const paid = (remittance.remittance_payments as { amount_centavos: number }[] | null)?.reduce((sum, payment) => sum + payment.amount_centavos, 0) ?? 0; const balance = Math.max(remittance.amount_due_centavos - paid, 0); const credit = Math.max(paid - remittance.amount_due_centavos, 0); return <li key={remittance.id} className="rounded-lg border bg-white p-4"><div className="flex items-center justify-between gap-4"><span className="font-medium">{remittance.service_date} · Body {(remittance.units as { body_number: string }[] | null)?.[0]?.body_number ?? "Unknown"}</span><span className="font-semibold">{formatPesos(remittance.amount_due_centavos)}</span></div><p className="mt-1 text-sm capitalize text-slate-600">{remittance.disposition.replace("_", " ")} · Driver {(remittance.drivers as { full_name: string }[] | null)?.[0]?.full_name ?? "Unknown"}</p><p className="mt-2 text-sm text-slate-600">Paid {formatPesos(paid)} · Balance {formatPesos(balance)}{credit ? ` · Credit ${formatPesos(credit)}` : ""}</p></li>; })}</ul></div></section>;
}
