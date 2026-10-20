import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPesos } from "@/lib/money/centavos";

export default async function RemittanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireApprovedSession();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: remittance } = await supabase.from("remittances").select("id, service_date, disposition, amount_due_centavos, notes, units(body_number), drivers(full_name), remittance_payments(id, paid_at, amount_centavos, notes)").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!remittance) notFound();
  const payments = (remittance.remittance_payments as { id: string; paid_at: string; amount_centavos: number; notes: string | null }[] | null) ?? [];
  const paid = payments.reduce((sum, payment) => sum + payment.amount_centavos, 0);
  return <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6"><div><p className="text-sm font-medium text-blue-700">Remittance detail</p><h1 className="mt-1 text-2xl font-semibold">{remittance.service_date}</h1><p className="mt-2 text-slate-600">Driver {(remittance.drivers as { full_name: string }[] | null)?.[0]?.full_name ?? "Unknown"} · Body {(remittance.units as { body_number: string }[] | null)?.[0]?.body_number ?? "Unknown"}</p></div><div className="rounded-lg border bg-white p-4"><p>Due: <strong>{formatPesos(remittance.amount_due_centavos)}</strong></p><p>Paid: <strong>{formatPesos(paid)}</strong></p><p>Balance: <strong>{formatPesos(Math.max(remittance.amount_due_centavos - paid, 0))}</strong></p></div><div><h2 className="text-lg font-semibold">Payment history</h2><ul className="mt-3 space-y-2">{payments.map((payment) => <li className="rounded-lg border bg-white p-3 text-sm" key={payment.id}>{new Date(payment.paid_at).toLocaleString()} · {formatPesos(payment.amount_centavos)}</li>)}</ul></div></section>;
}
