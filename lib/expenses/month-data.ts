import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoExpenses, demoUnits } from "@/lib/demo/mode";
import { monthNames, monthRange } from "@/lib/reports/periods";
import { allPages } from "@/lib/reports/report-data";
import { sortUnits } from "@/lib/reports/sheet-names";

// Feature 019 (contracts/expenses-month.md): the rows behind the monthly Expenses workbook. The route returns this
// JSON and the browser builds the workbook, as the remittance reports do (feature 014 research R4).

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface ExpenseMonthRow {
  unitId: string;
  /** YYYY-MM-DD. */
  date: string;
  category: string;
  customCategory: string | null;
  replacedDate: string | null;
  amountCentavos: number;
  notes: string;
}

export interface ExpensesMonthPayload {
  /** YYYY-MM. */
  month: string;
  monthLabel: string;
  fileName: string;
  /** Sheet order: natural order by unit name. */
  units: { id: string; name: string }[];
  /** Ordered by date, then by when each was entered. */
  expenses: ExpenseMonthRow[];
}

export const expensesFileName = (month: string) => `rolnet-expenses-${month}.xlsx`;
export const expensesMonthLabel = (month: string) => `${monthNames[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

type Raw = { id: string; unit_id: string; expense_date: string; category: string; custom_category: string | null; replaced_date: string | null; amount_centavos: number; notes: string | null; created_at?: string };

/**
 * One month of expenses and the units whose sheets they fill: every non-deleted, non-archived unit, plus an archived
 * unit that has an expense in the month. Deleted expenses are never read. No receipt data is selected.
 */
export async function loadExpensesMonth(supabase: Client | null, month: string): Promise<ExpensesMonthPayload> {
  const { from, to } = monthRange(month);
  let units: { id: string; name: string; archived: boolean }[];
  let rows: Raw[];
  if (!supabase) {
    units = demoUnits.map((unit) => ({ id: unit.id, name: unit.name, archived: unit.archived }));
    rows = demoExpenses.filter((row) => row.expense_date >= from && row.expense_date <= to).map((row) => ({ ...row, created_at: row.expense_date }));
  } else {
    const unitResult = await supabase.from("units").select("id, name, archived").is("deleted_at", null);
    if (unitResult.error) throw unitResult.error;
    units = (unitResult.data ?? []).map((unit) => ({ id: unit.id as string, name: unit.name as string, archived: Boolean(unit.archived) }));
    rows = await allPages<Raw>((start, end) => supabase.from("expenses")
      .select("id, unit_id, expense_date, category, custom_category, replaced_date, amount_centavos, notes, created_at")
      .is("deleted_at", null).gte("expense_date", from).lte("expense_date", to)
      .order("expense_date").order("created_at").order("id").range(start, end) as unknown as PromiseLike<{ data: Raw[] | null; error: unknown }>);
  }
  const withExpenses = new Set(rows.map((row) => row.unit_id));
  const sheets = sortUnits(units.filter((unit) => !unit.archived || withExpenses.has(unit.id)));
  const ordered = [...rows].sort((a, b) => a.expense_date.localeCompare(b.expense_date) || (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id));
  return {
    month,
    monthLabel: expensesMonthLabel(month),
    fileName: expensesFileName(month),
    units: sheets.map(({ id, name }) => ({ id, name })),
    expenses: ordered.map((row) => ({
      unitId: row.unit_id, date: row.expense_date, category: row.category, customCategory: row.custom_category,
      replacedDate: row.replaced_date, amountCentavos: Number(row.amount_centavos), notes: row.notes ?? "",
    })),
  };
}
