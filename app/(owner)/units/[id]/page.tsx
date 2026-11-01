import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { fleetToday, formatShortDate } from "@/lib/dates/fleet-date";
import { currentDriversOn } from "@/lib/assignments/current-drivers";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { DocumentList } from "@/components/documents/document-list";
import { StatusSelect } from "@/components/forms/status-select";
import { StatusHistory } from "@/components/records/status-history";
import { UnitDetailsSection } from "@/components/units/unit-details-section";
import { MonthlyAllowance } from "@/components/units/monthly-allowance";
import type { UnitStatus } from "@/lib/status/record-status";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { PagedList, listView } from "@/components/ui/paged-list";
import { documentTypeLabels } from "@/lib/validation/documents";
import { driverLabel, roleLabel, type DriverKind } from "@/lib/units/assignment-board";
import { monthlyAllowanceBlocks, windowStart } from "@/lib/units/monthly-allowance";
import { lastReplacedByCategory } from "@/lib/expenses/last-replaced";
import { LastReplaced } from "@/components/units/last-replaced";
import { MileageSection } from "@/components/units/mileage-section";

type Embed<T> = T | T[] | null;

/**
 * Unit history (feature 010, redesigned): header with the status control, an inline Details
 * section, then read-only monthly expenses vs allowance, status history, assignment history and
 * documents (FR-038 to FR-042). Owner only (FR-057). Feature 011 adds Last replaced per main part and
 * the Mileage section (formerly on the Maintenance page).
 */
export default async function UnitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requirePermission("manage_master_data");
  const { id } = await params;
  const query = await searchParams;
  const today = fleetToday();
  const supabase = await createSupabaseServerClient();
  const { data: unit } = await supabase.from("units").select("id, name, body_number, plate_number, make_model, status, current_mileage, archived, updated_at").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!unit) notFound();
  const since = `${windowStart(today)}-01`;
  const [drivers, { data: assignmentRows, error: assignmentsError }, { data: remittances, error: remittancesError }, { data: expenses, error: expensesError }, { data: documents }, { data: replacedRows, error: replacedError }, { data: readings, error: readingsError }] = await Promise.all([
    currentDriversOn(supabase, [id], today),
    supabase.from("unit_assignments").select("id, service_date, driver_id, drivers(full_name, driver_kind)").eq("unit_id", id).is("deleted_at", null).order("service_date", { ascending: false }),
    supabase.from("remittances").select("service_date, allowance_centavos").eq("unit_id", id).is("deleted_at", null).gte("service_date", since),
    supabase.from("expenses").select("expense_date, amount_centavos").eq("unit_id", id).is("deleted_at", null).gte("expense_date", since),
    supabase.from("documents").select("id, document_type, expires_on, lifecycle_status, document_number").eq("unit_id", id).is("deleted_at", null).order("lifecycle_status").order("expires_on", { ascending: false }),
    supabase.from("expenses").select("category, replaced_date").eq("unit_id", id).neq("category", "others").is("deleted_at", null),
    supabase.from("mileage_readings").select("id, reading_date, mileage, notes").eq("unit_id", id).is("deleted_at", null).order("reading_date", { ascending: false }),
  ]);
  for (const error of [assignmentsError, remittancesError, expensesError, replacedError, readingsError]) if (error) throw error;
  const todayDriver = drivers.get(id);
  const currentDriver = todayDriver ? driverLabel(todayDriver.driverName, todayDriver.role) : "No driver assigned today";
  const assignments = (assignmentRows ?? []).map((row) => {
    const driver = one(row.drivers as Embed<{ full_name: string; driver_kind: DriverKind }>);
    return { id: row.id as string, date: row.service_date as string, driverId: row.driver_id as string, driverName: driver?.full_name ?? "Archived driver", role: roleLabel(driver?.driver_kind ?? "primary") };
  });
  const pathname = `/units/${unit.id}`;
  // Each list keeps its own page and search in the URL (contracts/list-paging.md prefixes).
  const assignmentsRequest = parseListPage(query, "assignments_");
  const assignmentsPage = pageRows(assignments, assignmentsRequest, (a) => `${a.date} ${a.driverName} ${a.role}`);
  const documentsRequest = parseListPage(query, "documents_");
  const documentsPage = pageRows(documents ?? [], documentsRequest, (d) => `${documentTypeLabels[d.document_type] ?? d.document_type} ${d.document_number ?? ""} ${d.expires_on} ${d.lifecycle_status}`);
  const mileageRequest = parseListPage(query, "mileage_");
  const mileagePage = pageRows(readings ?? [], mileageRequest, () => "");
  const blocks = monthlyAllowanceBlocks((remittances ?? []).map((row) => ({ service_date: row.service_date, allowance_centavos: Number(row.allowance_centavos) })), (expenses ?? []).map((row) => ({ expense_date: row.expense_date, amount_centavos: Number(row.amount_centavos) })), today);

  return <section className="workspace">
    <Link className="muted-link mb-4 inline-flex items-center gap-1 text-body-sm font-semibold" href="/units"><ArrowLeft aria-hidden="true" size={16} />Back to units</Link>
    <PageHeader eyebrow="Unit history" title={unit.name} description={`Body ${unit.body_number} · ${unit.plate_number} · ${unit.make_model}`}
      action={<StatusSelect kind="unit" id={unit.id} value={unit.status as UnitStatus} label={`Status for ${unit.name}`} releaseName={unit.name} />} />
    <div className="mt-8 grid gap-10">
      <UnitDetailsSection key={unit.updated_at} unit={unit} currentDriver={currentDriver} canEdit />
      <MonthlyAllowance blocks={blocks} />
      <LastReplaced unitId={unit.id} rows={lastReplacedByCategory(replacedRows ?? [])} />
      <MileageSection unitId={unit.id} currentMileage={unit.current_mileage} list={listView(pathname, query, mileageRequest, mileagePage, { search: false })} readings={mileagePage.rows} />
      <StatusHistory kind="unit" id={unit.id} />
      <div><SectionHeading title="Assignment history" description="Newest first." /><div className="mt-4"><DataTable list={listView(pathname, query, assignmentsRequest, assignmentsPage, { searchLabel: "Search assignment history" })} headers={["Date", "Driver", "Role"]} empty={<p className="p-6 text-muted">No assignments recorded yet.</p>}>
        {assignmentsPage.rows.map((a) => <tr key={a.id}><td className="whitespace-nowrap font-data">{formatShortDate(a.date)}, {a.date.slice(0, 4)}</td><td className="font-semibold"><Link className="muted-link" href={`/drivers/${a.driverId}`}>{a.driverName}</Link></td><td>{a.role}</td></tr>)}
      </DataTable></div></div>
      <div><SectionHeading title="Documents" description="OR/CR, MTOP franchise and insurance for this unit." /><div className="mt-4"><PagedList list={listView(pathname, query, documentsRequest, documentsPage, { searchLabel: "Search this unit's documents" })} hasRows={documentsPage.rows.length > 0} empty={<p className="py-6 text-body-sm text-muted">No documents for this unit yet. Upload them on the Documents page.</p>}><DocumentList documents={documentsPage.rows} emptyText="" /></PagedList></div></div>
    </div>
  </section>;
}
