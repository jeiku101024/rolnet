import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { formatPesos } from "@/lib/money/centavos";
import { fleetTimeZone } from "@/lib/dates/fleet-date";
import { remittanceTotals } from "@/lib/remittances/totals";
import { BalanceBadge } from "@/components/remittances/balance-badge";
import { CorrectPaymentForm, PaymentForm, RemittanceNotesForm, ReverseRemittanceForm } from "@/components/forms/remittance-detail-forms";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { listView } from "@/components/ui/paged-list";

const paidAtFormat = new Intl.DateTimeFormat("en-PH", { timeZone: fleetTimeZone(), dateStyle: "medium", timeStyle: "short" });

export default async function RemittanceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: remittance } = await supabase.from("remittances").select("id, service_date, disposition, amount_due_centavos, notes, updated_at, unit_id, driver_id, units(body_number), drivers(full_name), remittance_payments(id, paid_at, amount_centavos, notes)").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!remittance) notFound();
  const payments = [...(remittance.remittance_payments ?? [])].sort((a, b) => a.paid_at.localeCompare(b.paid_at));
  const totals = remittanceTotals(remittance.amount_due_centavos, payments);
  const body = one(remittance.units)?.body_number ?? "Unknown";
  const driver = one(remittance.drivers)?.full_name ?? "Unknown";
  const paymentsRequest = parseListPage(query, "payments_");
  const paymentsPage = pageRows(payments, paymentsRequest, (p) => `${paidAtFormat.format(new Date(p.paid_at))} ${formatPesos(p.amount_centavos)} ${p.notes ?? ""}`);
  return <section className="workspace">
    <PageHeader eyebrow="Remittance detail" title={remittance.service_date} description={`Driver ${driver} · Body ${body} · ${remittance.disposition === "overnight_overtime" ? "Overnight / overtime" : "Returned to garage"}`} />
    <p className="mt-2"><Link className="muted-link text-body-sm" href="/remittances">Back to remittances</Link></p>
    <div className="mt-6 workspace-grid">
      <div className="space-y-6 border-t border-rule pt-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-label font-bold uppercase text-muted">Due</dt><dd className="mt-1 font-data text-page-title font-bold">{formatPesos(remittance.amount_due_centavos)}</dd></div>
          <div><dt className="text-label font-bold uppercase text-muted">Paid</dt><dd className="mt-1 font-data text-page-title font-bold">{formatPesos(totals.paid)}</dd></div>
          <div><dt className="text-label font-bold uppercase text-muted">{totals.credit ? "Credit (overpaid)" : "Balance"}</dt><dd className="mt-1"><BalanceBadge balance={totals.balance} credit={totals.credit} /></dd></div>
        </dl>
        <PaymentForm remittanceId={remittance.id} balanceText={formatPesos(totals.balance)} />
        <RemittanceNotesForm key={remittance.updated_at} remittanceId={remittance.id} notes={remittance.notes} updatedAt={remittance.updated_at} />
        {isOwner ? <ReverseRemittanceForm remittanceId={remittance.id} /> : null}
      </div>
      <div><SectionHeading title="Payment history" description={isOwner ? "Void a wrong payment with a reason, then add the correct amount." : undefined} /><div className="mt-4"><DataTable list={listView(`/remittances/${remittance.id}`, query, paymentsRequest, paymentsPage, { searchLabel: "Search payments" })} headers={isOwner ? ["Paid at", "Amount", "Notes", "Correction"] : ["Paid at", "Amount", "Notes"]} empty={<p className="p-6 text-muted">No payments recorded yet.</p>}>{paymentsPage.rows.map((p) => <tr key={p.id}><td className="font-data">{paidAtFormat.format(new Date(p.paid_at))}</td><td className="font-data">{formatPesos(p.amount_centavos)}</td><td>{p.notes || "—"}</td>{isOwner ? <td><CorrectPaymentForm paymentId={p.id} remittanceId={remittance.id} /></td> : null}</tr>)}</DataTable></div></div>
    </div>
  </section>;
}
