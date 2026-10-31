import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { demoExpenses, demoRemittances, demoUnits } from "@/lib/demo/mode";
import type { DateRange } from "@/lib/reports/periods";
import type { ReportData } from "@/lib/reports/report-layout";

// Feature 009 (research R7): the rows behind a report. PostgREST returns at most 1,000 rows per
// request, so both queries are read in pages until a short page.

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const pageSize = 1000;

async function allPages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await read(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) return rows;
  }
}

function sumByDate(rows: { date: string; centavos: number }[]) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.date, (map.get(row.date) ?? 0) + row.centavos);
  return map;
}

/** Active remittances and expenses in the range, for the whole fleet or one unit. */
export async function loadReportData(supabase: Client | null, { from, to, unitId }: DateRange & { unitId: string | null }): Promise<ReportData> {
  if (!supabase) {
    const remittances = demoRemittances.filter((row) => row.service_date >= from && row.service_date <= to && (!unitId || row.unit_id === unitId))
      .sort((a, b) => a.service_date.localeCompare(b.service_date))
      .map((row) => ({ service_date: row.service_date, rentalCentavos: row.amount_due_centavos, allowanceCentavos: row.allowance_centavos, depositCentavos: row.deposit_centavos, driverName: one(row.drivers)?.full_name ?? "Unknown driver" }));
    const expenses = demoExpenses.filter((row) => row.expense_date >= from && row.expense_date <= to && (!unitId || row.unit_id === unitId));
    return { remittances, expensesByDate: sumByDate(expenses.map((row) => ({ date: row.expense_date, centavos: row.amount_centavos }))) };
  }
  const [remittances, expenses] = await Promise.all([
    allPages((start, end) => {
      let query = supabase.from("remittances").select("service_date, amount_due_centavos, allowance_centavos, deposit_centavos, drivers(full_name)")
        .is("deleted_at", null).gte("service_date", from).lte("service_date", to);
      if (unitId) query = query.eq("unit_id", unitId);
      return query.order("service_date").order("created_at").order("id").range(start, end);
    }),
    allPages((start, end) => {
      let query = supabase.from("expenses").select("expense_date, amount_centavos").is("deleted_at", null).gte("expense_date", from).lte("expense_date", to);
      if (unitId) query = query.eq("unit_id", unitId);
      return query.order("expense_date").order("id").range(start, end);
    }),
  ]);
  return {
    remittances: remittances.map((row) => ({
      service_date: row.service_date as string, rentalCentavos: Number(row.amount_due_centavos), allowanceCentavos: Number(row.allowance_centavos),
      depositCentavos: Number(row.deposit_centavos), driverName: one(row.drivers as { full_name: string } | { full_name: string }[] | null)?.full_name ?? "Unknown driver",
    })),
    expensesByDate: sumByDate(expenses.map((row) => ({ date: row.expense_date as string, centavos: Number(row.amount_centavos) }))),
  };
}

export interface ReportUnit { id: string; name: string; label: string }

const byName = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Every unit that isn't deleted, retired ones labelled, for the One unit scope (FR-021). */
export async function loadReportUnits(supabase: Client | null): Promise<ReportUnit[]> {
  let rows: { id: string; name: string; body_number: string; status: string }[];
  if (supabase) {
    const { data, error } = await supabase.from("units").select("id, name, body_number, status").is("deleted_at", null);
    if (error) throw error;
    rows = data ?? [];
  } else {
    rows = demoUnits;
  }
  return rows.map((unit) => ({ id: unit.id, name: unit.name, label: `${unit.name} (${unit.body_number})${unit.status === "retired" ? " (retired)" : ""}` }))
    .sort((a, b) => byName.compare(a.name, b.name));
}

/** A unit name safe for a file name: letters, digits and dashes. */
export function fileSafe(name: string) {
  return name.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "unit";
}
