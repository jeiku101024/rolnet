import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { demoExpenses, demoRemittances, demoUnits } from "@/lib/demo/mode";
import type { DateRange } from "@/lib/reports/periods";
import { sortUnits } from "@/lib/reports/sheet-names";
import type { UnitDailyData, UnitYearData } from "@/lib/reports/report-layout";
import type { Database } from "@/types/database";

// Feature 014 (research R5): the rows behind a report. PostgREST returns at most 1,000 rows per request, so
// every read is paged until a short page. Weekly and monthly reports read daily rows; the yearly report
// reads one row per unit and month from report_unit_month_totals(), because a year of daily rows for 100
// units is about 36,500 rows.

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const pageSize = 1000;
const chunkSize = 40;

async function allPages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await read(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) return rows;
  }
}

export interface ReportUnit { id: string; name: string; archived: boolean }

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

/**
 * The units a report covers, in natural name order (spec FR-015): every non-deleted, non-archived unit, plus
 * archived units with at least one non-deleted remittance or expense in the range.
 */
export async function loadReportUnits(supabase: Client | null, { from, to }: DateRange): Promise<ReportUnit[]> {
  let units: ReportUnit[];
  const withRecords = new Set<string>();
  if (!supabase) {
    units = demoUnits.map((unit) => ({ id: unit.id, name: unit.name, archived: unit.archived }));
    for (const row of demoRemittances) if (row.service_date >= from && row.service_date <= to) withRecords.add(row.unit_id);
    for (const row of demoExpenses) if (row.expense_date >= from && row.expense_date <= to) withRecords.add(row.unit_id);
  } else {
    const { data, error } = await supabase.from("units").select("id, name, archived").is("deleted_at", null);
    if (error) throw error;
    units = (data ?? []).map((unit) => ({ id: unit.id as string, name: unit.name as string, archived: Boolean(unit.archived) }));
    const archivedIds = units.filter((unit) => unit.archived).map((unit) => unit.id);
    for (const ids of chunks(archivedIds, chunkSize)) {
      const [remittances, expenses] = await Promise.all([
        allPages((start, end) => supabase.from("remittances").select("unit_id").in("unit_id", ids).is("deleted_at", null).gte("service_date", from).lte("service_date", to).order("id").range(start, end)),
        allPages((start, end) => supabase.from("expenses").select("unit_id").in("unit_id", ids).is("deleted_at", null).gte("expense_date", from).lte("expense_date", to).order("id").range(start, end)),
      ]);
      for (const row of [...remittances, ...expenses]) withRecords.add(row.unit_id as string);
    }
  }
  return sortUnits(units.filter((unit) => !unit.archived || withRecords.has(unit.id)));
}

/** Remittances and expenses by unit for a week or a month, for every unit or one (research R5). */
export async function loadDailyData(supabase: Client | null, { from, to }: DateRange, unitId: string | null): Promise<Map<string, UnitDailyData>> {
  const result = new Map<string, UnitDailyData>();
  const unitData = (id: string) => {
    let data = result.get(id);
    if (!data) { data = { remittances: [], expensesByDate: new Map() }; result.set(id, data); }
    return data;
  };
  const addExpense = (id: string, date: string, centavos: number) => {
    const data = unitData(id);
    data.expensesByDate.set(date, (data.expensesByDate.get(date) ?? 0) + centavos);
  };
  if (!supabase) {
    const inRange = (date: string) => date >= from && date <= to;
    const sorted = demoRemittances.filter((row) => inRange(row.service_date) && (!unitId || row.unit_id === unitId)).sort((a, b) => a.service_date.localeCompare(b.service_date));
    for (const row of sorted) unitData(row.unit_id).remittances.push({ date: row.service_date, rentalCentavos: row.amount_due_centavos, allowanceCentavos: row.allowance_centavos, driverName: one(row.drivers)?.full_name ?? "Unknown driver" });
    for (const row of demoExpenses.filter((item) => inRange(item.expense_date) && (!unitId || item.unit_id === unitId))) addExpense(row.unit_id, row.expense_date, row.amount_centavos);
    return result;
  }
  const [remittances, expenses] = await Promise.all([
    allPages((start, end) => {
      let query = supabase.from("remittances").select("unit_id, service_date, amount_due_centavos, allowance_centavos, drivers(full_name)")
        .is("deleted_at", null).gte("service_date", from).lte("service_date", to);
      if (unitId) query = query.eq("unit_id", unitId);
      return query.order("service_date").order("created_at").order("id").range(start, end);
    }),
    allPages((start, end) => {
      let query = supabase.from("expenses").select("unit_id, expense_date, amount_centavos").is("deleted_at", null).gte("expense_date", from).lte("expense_date", to);
      if (unitId) query = query.eq("unit_id", unitId);
      return query.order("expense_date").order("id").range(start, end);
    }),
  ]);
  for (const row of remittances) {
    unitData(row.unit_id as string).remittances.push({
      date: row.service_date as string,
      rentalCentavos: Number(row.amount_due_centavos),
      allowanceCentavos: Number(row.allowance_centavos),
      driverName: one(row.drivers as { full_name: string } | { full_name: string }[] | null)?.full_name ?? "Unknown driver",
    });
  }
  for (const row of expenses) addExpense(row.unit_id as string, row.expense_date as string, Number(row.amount_centavos));
  return result;
}

const emptyYear = (): UnitYearData => ({ months: Array.from({ length: 12 }, () => ({ rentalCentavos: 0, allowanceCentavos: 0 })), expenseCentavos: 0 });

/** Monthly totals by unit for a year, from the database's aggregate function (research R5). */
export async function loadYearlyData(supabase: Client | null, year: number, unitId: string | null): Promise<Map<string, UnitYearData>> {
  const result = new Map<string, UnitYearData>();
  const unitData = (id: string) => {
    let data = result.get(id);
    if (!data) { data = emptyYear(); result.set(id, data); }
    return data;
  };
  const range = { from: `${year}-01-01`, to: `${year}-12-31` };
  if (!supabase) {
    for (const row of demoRemittances.filter((item) => item.service_date >= range.from && item.service_date <= range.to && (!unitId || item.unit_id === unitId))) {
      const month = unitData(row.unit_id).months[Number(row.service_date.slice(5, 7)) - 1];
      month.rentalCentavos += row.amount_due_centavos;
      month.allowanceCentavos += row.allowance_centavos;
    }
    for (const row of demoExpenses.filter((item) => item.expense_date >= range.from && item.expense_date <= range.to && (!unitId || item.unit_id === unitId))) unitData(row.unit_id).expenseCentavos += row.amount_centavos;
    return result;
  }
  type MonthTotals = Database["public"]["Functions"]["report_unit_month_totals"]["Returns"][number];
  const rows = await allPages<MonthTotals>((start, end) => supabase.rpc("report_unit_month_totals", { p_from: range.from, p_to: range.to }).range(start, end) as unknown as PromiseLike<{ data: MonthTotals[] | null; error: unknown }>);
  for (const row of rows) {
    const id = row.unit_id;
    if (unitId && id !== unitId) continue;
    const data = unitData(id);
    const month = data.months[Number(row.month.slice(5, 7)) - 1];
    month.rentalCentavos += Number(row.rental_centavos);
    month.allowanceCentavos += Number(row.allowance_centavos);
    data.expenseCentavos += Number(row.expense_centavos);
  }
  return result;
}
