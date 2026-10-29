import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { formatPesos } from "@/lib/money/centavos";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/feedback";

export default async function RemittanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireApprovedSession(); const { id } = await params; const supabase = await createSupabaseServerClient();
  const { data: remittance } = await supabase.from("remittances").select("id, service_date, disposition, amount_due_centavos, notes, units(body_number), drivers(full_name), remittance_payments(id, paid_at, amount_centavos, notes)").eq("id", id).is("deleted_at", null).maybeSingle(); if (!remittance) notFound();
  const payments = (remittance.remittance_payments as { id: string; paid_at: string; amount_centavos: number; notes: string | null }[] | null) ?? []; const paid = payments.reduce((sum, payment) => sum + payment.amount_centavos, 0); const balance = Math.max(remittance.amount_due_centavos - paid, 0);
  return <section className="workspace"><PageHeader eyebrow="Remittance detail" title={remittance.service_date} description={`Driver ${one(remittance.drivers)?.full_name ?? "Unknown"} · Body ${one(remittance.units)?.body_number ?? "Unknown"}`} /><div className="mt-8 workspace-grid"><div className="border-t border-rule pt-5"><dl className="grid gap-4"><div><dt className="text-label font-bold uppercase text-muted">Due</dt><dd className="mt-1 font-data text-page-title font-bold">{formatPesos(remittance.amount_due_centavos)}</dd></div><div><dt className="text-label font-bold uppercase text-muted">Paid</dt><dd className="mt-1 font-data text-body font-bold">{formatPesos(paid)}</dd></div><div><dt className="text-label font-bold uppercase text-muted">Balance</dt><dd className="mt-1"><StatusBadge label={formatPesos(balance)} tone={balance ? "warning" : "success"} /></dd></div></dl></div><div><SectionHeading title="Payment history" /><div className="mt-4"><DataTable headers={["Paid at", "Amount", "Notes"]} empty={<p className="p-6 text-muted">No payments recorded yet.</p>}>{payments.map((p) => <tr key={p.id}><td className="font-data">{new Date(p.paid_at).toLocaleString()}</td><td className="font-data">{formatPesos(p.amount_centavos)}</td><td>{p.notes || "—"}</td></tr>)}</DataTable></div></div></div></section>;
}
