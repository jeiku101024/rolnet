import Link from "next/link";
import type { SessionProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { formatPesos } from "@/lib/money/centavos";
import { fleetToday, formatLongDate } from "@/lib/dates/fleet-date";
import { remittanceTotals } from "@/lib/remittances/totals";
import { dailyHref } from "@/lib/remittances/view-params";
import { demoDrivers, demoMode, demoRemittances, demoUnits } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/feedback";
import { BalanceBadge } from "@/components/remittances/balance-badge";
import { MoneyText } from "@/components/remittances/money-text";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { loadListPage } from "@/lib/pagination/search-filter";
import { activeValue, applyFilters, applySort, controlRows, controlsView, parseControls, prepareSpec } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";
import { dispositionLabels, searchSpecs } from "@/lib/pagination/search-specs";
import { listView } from "@/components/ui/paged-list";

const searchText = "Search by driver or unit";

/** List view (feature 008, User Story 4): the read-only remittance history, newest first, with the stored allowance and deposit (feature 009). */
export async function RemittancesList({ profile, searchParams }: { profile: SessionProfile; searchParams: SearchParams }) {
  // Every link built from these params (search, filters, pages) keeps List view.
  const params: SearchParams = { ...searchParams, view: "list" };
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
  const unpaidIds = supabase && unpaidOnly ? ((await supabase.rpc("driver_outstanding_balances", { as_of: fleetToday() })).data ?? []).flatMap((row: { unpaid_remittances: unknown }) => ((row.unpaid_remittances as { remittance_id: string }[] | null) ?? []).map((item) => item.remittance_id)) : [];
  const result = supabase
    ? await loadListPage(supabase, request, searchSpecs.remittances, (from, to, filter) => {
      let query = supabase.from("remittances").select("id, service_date, disposition, amount_due_centavos, allowance_centavos, deposit_centavos, notes, updated_at, units(body_number), drivers(full_name), remittance_payments(amount_centavos)", { count: "exact" }).is("deleted_at", null);
      if (unpaidOnly) query = query.in("id", unpaidIds);
      query = applyFilters(query, controls);
      if (filter) query = query.or(filter);
      return applySort(query, controls).range(from, to);
    })
    : pageRows(controlRows(demoRemittances.filter((r) => !unpaidOnly || remittanceTotals(r.amount_due_centavos, r.remittance_payments).balance > 0), controls), request, (r) => `${r.service_date} ${one(r.units)?.body_number} ${one(r.drivers)?.full_name} ${dispositionLabels[r.disposition]} ${r.notes}`);
  const note = <>Turn on <Link className="muted-link" href={dailyHref()}>Daily view</Link> to record or correct each unit&apos;s remittance. List view shows all records, newest to oldest.</>;
  const list = listView("/remittances", params, request, result, { searchLabel: searchText, searchPlaceholder: searchText, controls: controlsView(controls), note });
  return <DataTable list={list} headers={["Date", "Unit / driver", "Disposition", "Rental", "Paid", "Balance", "Allowance", "Deposit"]} empty={<p className="p-6 text-muted">No remittances recorded yet.</p>}>{result.rows.map((r) => { const totals = remittanceTotals(r.amount_due_centavos, r.remittance_payments); return <tr key={r.id}>
    <td className="font-data"><Link className="muted-link" href={dailyHref(r.service_date)} aria-label={`Open ${formatLongDate(r.service_date)} in Daily view`}>{r.service_date}</Link></td>
    <td><p className="font-semibold">Body {one(r.units)?.body_number ?? "Unknown"}</p><p className="text-body-sm text-muted">{one(r.drivers)?.full_name ?? "Unknown"}</p></td>
    <td><StatusBadge label={r.disposition === "overnight_overtime" ? "Overnight / overtime" : "Returned"} tone="muted" /></td>
    <td className="font-data">{formatPesos(r.amount_due_centavos)}</td>
    <td className="font-data">{formatPesos(totals.paid)}</td>
    <td><BalanceBadge balance={totals.balance} /></td>
    <td className="font-data"><MoneyText centavos={Number(r.allowance_centavos)} /></td>
    <td className="font-data"><MoneyText centavos={Number(r.deposit_centavos)} /></td>
  </tr>; })}</DataTable>;
}
