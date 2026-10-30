import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { formatPesos } from "@/lib/money/centavos";
import { addDays, fleetToday } from "@/lib/dates/fleet-date";
import { remittanceTotals } from "@/lib/remittances/totals";
import { RemittanceForm } from "@/components/forms/remittance-form";
import { demoAssignments, demoDrivers, demoMode, demoRemittances, demoUnits } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/feedback";
import { BalanceBadge } from "@/components/remittances/balance-badge";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { loadListPage } from "@/lib/pagination/search-filter";
import { activeValue, applyFilters, applySort, controlRows, controlsView, parseControls, prepareSpec } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";
import { dispositionLabels, searchSpecs } from "@/lib/pagination/search-specs";
import { listView } from "@/components/ui/paged-list";

export default async function RemittancesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const params = await searchParams;
  const request = parseListPage(params);
  const supabase = demoMode ? null : await createSupabaseServerClient();
  // Sort and filter (US8). Unit and driver choices come from the fleet's records; the unpaid-balance
  // filter (the dashboard's "View all") is owner-only, like the is_owner() check in its RPC.
  const [{ data: unitRows }, { data: driverRows }] = supabase ? await Promise.all([
    supabase.from("units").select("id, body_number").is("deleted_at", null).order("body_number"),
    supabase.from("drivers").select("id, full_name").is("deleted_at", null).order("full_name"),
  ]) : [{ data: demoUnits }, { data: demoDrivers }];
  const controls = parseControls(params, prepareSpec(listControlSpecs.remittances, { isOwner: profile.role === "owner", options: { unit: (unitRows ?? []).map((unit) => ({ value: unit.id, label: `Body ${unit.body_number}` })), driver: (driverRows ?? []).map((driver) => ({ value: driver.id, label: driver.full_name })) } }));
  const unpaidOnly = activeValue(controls, "balance") === "unpaid";
  // Assignments that can still receive entries: open, ended in the last 60 days, or recent backups.
  const since = addDays(fleetToday(), -60);
  const unpaidIds = supabase && unpaidOnly ? ((await supabase.rpc("driver_outstanding_balances", { as_of: fleetToday() })).data ?? []).flatMap((row: { unpaid_remittances: unknown }) => ((row.unpaid_remittances as { remittance_id: string }[] | null) ?? []).map((item) => item.remittance_id)) : [];
  const [{ data: assignments }, result] = supabase ? await Promise.all([
    supabase.from("driver_assignments").select("id, assignment_type, starts_on, ends_on, units(body_number), drivers(full_name)").is("deleted_at", null).or(`ends_on.is.null,ends_on.gte.${since}`).order("starts_on", { ascending: false }),
    loadListPage(supabase, request, searchSpecs.remittances, (from, to, filter) => {
      let query = supabase.from("remittances").select("id, service_date, disposition, amount_due_centavos, notes, updated_at, units(body_number), drivers(full_name), remittance_payments(amount_centavos)", { count: "exact" }).is("deleted_at", null);
      if (unpaidOnly) query = query.in("id", unpaidIds);
      query = applyFilters(query, controls);
      if (filter) query = query.or(filter);
      return applySort(query, controls).range(from, to);
    }),
  ]) : [{ data: demoAssignments }, pageRows(controlRows(demoRemittances.filter((r) => !unpaidOnly || remittanceTotals(r.amount_due_centavos, r.remittance_payments).balance > 0), controls), request, (r) => `${r.service_date} ${one(r.units)?.body_number} ${one(r.drivers)?.full_name} ${dispositionLabels[r.disposition]} ${r.notes}`)];
  const remittances = result.rows;
  const list = listView("/remittances", params, request, result, { searchLabel: "Search remittances", controls: controlsView(controls) });
  return <section className="workspace"><PageHeader eyebrow="Daily income" title="Remittances" description="Returned units are ₱180. Bring-home/overtime days are ₱300 total. Open an entry to add a payment or edit notes." />
    <div className="mt-8 workspace-grid">
      <div><DataTable list={list} headers={["Date", "Unit / driver", "Disposition", "Due", "Paid", "Balance"]} empty={<p className="p-6 text-muted">No remittances recorded yet.</p>}>{remittances.map((r) => { const totals = remittanceTotals(r.amount_due_centavos, r.remittance_payments); return <tr key={r.id}>
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
