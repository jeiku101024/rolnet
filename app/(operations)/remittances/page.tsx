import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPesos } from "@/lib/money/centavos";
import { RemittanceForm } from "@/components/forms/remittance-form";
import { demoAssignments, demoMode, demoRemittances } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/feedback";

export default async function RemittancesPage() {
  await requireApprovedSession();
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const [{ data: assignments }, { data: remittances }] = supabase ? await Promise.all([supabase.from("driver_assignments").select("id, starts_on, ends_on, units(body_number), drivers(full_name)").is("deleted_at", null).order("starts_on", { ascending: false }), supabase.from("remittances").select("id, service_date, disposition, amount_due_centavos, notes, updated_at, units(body_number), drivers(full_name), remittance_payments(amount_centavos)").is("deleted_at", null).order("service_date", { ascending: false }).limit(50)]) : [{ data: demoAssignments }, { data: demoRemittances }];
  return <section className="workspace"><PageHeader eyebrow="Daily income" title="Remittances" description="Returned units are ₱180. Bring-home/overtime days are ₱300 total." /><div className="mt-8 workspace-grid"><div><DataTable headers={["Date", "Unit / driver", "Disposition", "Due", "Paid", "Balance"]} empty={<p className="p-6 text-muted">No remittances recorded yet.</p>}>{(remittances ?? []).map((r) => { const paid = (r.remittance_payments as { amount_centavos: number }[] | null)?.reduce((sum, p) => sum + p.amount_centavos, 0) ?? 0; const balance = Math.max(r.amount_due_centavos - paid, 0); return <tr key={r.id}><td className="font-data">{r.service_date}</td><td><p className="font-semibold">Body {(r.units as { body_number: string }[] | null)?.[0]?.body_number ?? "Unknown"}</p><p className="text-body-sm text-muted">{(r.drivers as { full_name: string }[] | null)?.[0]?.full_name ?? "Unknown"}</p></td><td><StatusBadge label={r.disposition.replace("_", " ")} tone="muted" /></td><td className="font-data">{formatPesos(r.amount_due_centavos)}</td><td className="font-data">{formatPesos(paid)}</td><td><StatusBadge label={formatPesos(balance)} tone={balance ? "warning" : "success"} /></td></tr>; })}</DataTable></div><aside className="border-t border-rule pt-5"><h2 className="text-section-title font-bold">Record remittance</h2><p className="mt-1 mb-4 text-body-sm text-muted">The amount due is calculated from the unit’s disposition.</p><RemittanceForm assignments={(assignments ?? []) as never[]} /></aside></div></section>;
}
