import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { formatPesos } from "@/lib/money/centavos";
import { addDays, fleetToday } from "@/lib/dates/fleet-date";
import { remittanceTotals } from "@/lib/remittances/totals";
import { RemittanceForm } from "@/components/forms/remittance-form";
import { demoAssignments, demoMode, demoRemittances } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/feedback";
import { BalanceBadge } from "@/components/remittances/balance-badge";

export default async function RemittancesPage() {
  await requireApprovedSession();
  const supabase = demoMode ? null : await createSupabaseServerClient();
  // Assignments that can still receive entries: open, ended in the last 60 days, or recent backups.
  const since = addDays(fleetToday(), -60);
  const [{ data: assignments }, { data: remittances }] = supabase ? await Promise.all([
    supabase.from("driver_assignments").select("id, assignment_type, starts_on, ends_on, units(body_number), drivers(full_name)").is("deleted_at", null).or(`ends_on.is.null,ends_on.gte.${since}`).order("starts_on", { ascending: false }),
    supabase.from("remittances").select("id, service_date, disposition, amount_due_centavos, notes, updated_at, units(body_number), drivers(full_name), remittance_payments(amount_centavos)").is("deleted_at", null).order("service_date", { ascending: false }).limit(50),
  ]) : [{ data: demoAssignments }, { data: demoRemittances }];
  return <section className="workspace"><PageHeader eyebrow="Daily income" title="Remittances" description="Returned units are ₱180. Bring-home/overtime days are ₱300 total. Open an entry to add a payment or edit notes." />
    <div className="mt-8 workspace-grid">
      <div><DataTable headers={["Date", "Unit / driver", "Disposition", "Due", "Paid", "Balance"]} empty={<p className="p-6 text-muted">No remittances recorded yet.</p>}>{(remittances ?? []).map((r) => { const totals = remittanceTotals(r.amount_due_centavos, r.remittance_payments); return <tr key={r.id}>
        <td className="font-data"><Link className="muted-link" href={`/remittances/${r.id}`}>{r.service_date}</Link></td>
        <td><p className="font-semibold">Body {one(r.units)?.body_number ?? "Unknown"}</p><p className="text-body-sm text-muted">{one(r.drivers)?.full_name ?? "Unknown"}</p></td>
        <td><StatusBadge label={r.disposition === "overnight_overtime" ? "Overnight / overtime" : "Returned"} tone="muted" /></td>
        <td className="font-data">{formatPesos(r.amount_due_centavos)}</td>
        <td className="font-data">{formatPesos(totals.paid)}</td>
        <td><BalanceBadge balance={totals.balance} credit={totals.credit} /></td>
      </tr>; })}</DataTable></div>
      <aside className="border-t border-rule pt-5"><h2 className="text-section-title font-bold">Record remittance</h2><p className="mt-1 mb-4 text-body-sm text-muted">The amount due is calculated from the unit’s disposition.</p><RemittanceForm assignments={assignments ?? []} /></aside>
    </div>
  </section>;
}
