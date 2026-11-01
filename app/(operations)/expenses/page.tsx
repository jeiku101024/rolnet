import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { formatPesos } from "@/lib/money/centavos";
import { formatShortDate } from "@/lib/dates/fleet-date";
import { demoExpenses, demoMode, demoUnits } from "@/lib/demo/mode";
import { categoryText, type ExpenseCategory } from "@/lib/expenses/categories";
import { loadExpenseTotal, sumAmounts, type AmountQuery } from "@/lib/expenses/list-total";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { pageRows, parseListPage, fetchListPage, type SearchParams } from "@/lib/pagination/list-page";
import { buildSearchFilter, findRelatedIds } from "@/lib/pagination/search-filter";
import { applyFilters, applySort, controlRows, controlsView, parseControls, prepareSpec } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";
import { searchSpecs } from "@/lib/pagination/search-specs";
import { listView } from "@/components/ui/paged-list";
import { AddExpenseDialog, type EditableExpense } from "@/components/expenses/expense-dialog";
import { ExpenseRowMenu } from "@/components/expenses/expense-row-menu";
import { CategoryCell, LastReplacedCell, NotesCell } from "@/components/expenses/expense-cells";

const expenseColumns = "id, unit_id, category, custom_category, replaced_date, expense_date, amount_centavos, notes, needs_review, source_table, updated_at, receipt_object_path, units(body_number, plate_number, name)";

type ExpenseRow = {
  id: string; unit_id: string; category: ExpenseCategory; custom_category: string | null; replaced_date: string | null; expense_date: string;
  amount_centavos: number; notes: string | null; needs_review: boolean; source_table: string | null; updated_at: string; receipt_object_path: string | null;
  units: { body_number: string; plate_number: string; name: string } | { body_number: string; plate_number: string; name: string }[] | null;
};

/**
 * Expenses (feature 011): one page for unit costs, including parts and tires (formerly Maintenance).
 * Full-width table; Add expense opens a modal; each row's 3-dot menu edits or (owner) deletes.
 */
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const params = await searchParams;
  const request = parseListPage(params);
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const { data: units } = supabase
    ? await supabase.from("units").select("id, body_number, plate_number, archived").is("deleted_at", null).order("body_number")
    : { data: demoUnits };
  const allUnits = (units ?? []) as { id: string; body_number: string; plate_number: string; archived: boolean }[];
  const activeUnits = allUnits.filter((unit) => !unit.archived).map(({ id, body_number, plate_number }) => ({ id, body_number, plate_number }));
  // Filters: every unit (archived ones keep their history), the fixed categories, dates, receipt, review.
  const controls = parseControls(params, prepareSpec(listControlSpecs.expenses, { options: { unit: allUnits.map((unit) => ({ value: unit.id, label: `Body ${unit.body_number}` })) } }));

  let result: { rows: ExpenseRow[]; page: number; lastPage: number; total: number; rangeLabel: string };
  let totalCentavos: number;
  if (supabase) {
    const searchFilter = buildSearchFilter(searchSpecs.expenses, request.q, await findRelatedIds(supabase, searchSpecs.expenses, request.q));
    result = await fetchListPage<ExpenseRow>(request, (from, to) => {
      let query = supabase.from("expenses").select(expenseColumns, { count: "exact" }).is("deleted_at", null);
      query = applyFilters(query, controls);
      if (searchFilter) query = query.or(searchFilter);
      return applySort(query, controls).range(from, to) as unknown as PromiseLike<{ data: ExpenseRow[] | null; count: number | null }>;
    });
    totalCentavos = await loadExpenseTotal(() => supabase.from("expenses").select("amount_centavos") as unknown as AmountQuery, controls, searchFilter, result.total);
  } else {
    const textOf = (expense: (typeof demoExpenses)[number]) => `${expense.expense_date} ${categoryText(expense)} ${one(expense.units)?.body_number} ${expense.notes}`;
    const needle = request.q.toLowerCase();
    const matching = controlRows(demoExpenses, controls).filter((expense) => !needle || textOf(expense).toLowerCase().includes(needle));
    result = pageRows(matching, { ...request, q: "" }, textOf) as typeof result;
    totalCentavos = sumAmounts(matching);
  }
  const expenses = result.rows;
  const filtered = Boolean(request.q) || controls.count > 0;
  const list = listView("/expenses", params, request, result, {
    searchLabel: "Search expenses",
    searchPlaceholder: "Search notes, unit, or category",
    controls: controlsView(controls),
    action: <AddExpenseDialog units={activeUnits} />,
    hint: formatPesos(totalCentavos),
    emptyText: "No expenses match these filters.",
  });
  return <section className="workspace">
    <PageHeader eyebrow="Costs and upkeep" title="Expenses" description="Record fuel, parts, repairs and other unit costs." />
    <div className="mt-8">
      <DataTable list={list} headers={["Date", "Unit", "Category", "Amount", "Last Replaced", "Notes", "Options"]}
        empty={filtered ? undefined : <EmptyState title="No expenses recorded yet." description="Add the first expense to start tracking unit costs." action={<AddExpenseDialog units={activeUnits} />} />}>
        {expenses.map((expense) => {
          const unit = one(expense.units);
          const editable: EditableExpense = { ...expense, units: unit ? { body_number: unit.body_number, plate_number: unit.plate_number } : null };
          return <tr key={expense.id}>
            <td className="font-data whitespace-nowrap">{formatShortDate(expense.expense_date)}</td>
            <td className="whitespace-nowrap">{unit ? (isOwner ? <Link className="muted-link font-semibold" href={`/units/${expense.unit_id}`}>Body {unit.body_number}</Link> : <span className="font-semibold">Body {unit.body_number}</span>) : "Unit"}</td>
            <td><CategoryCell expense={expense} /></td>
            <td className="text-right font-data whitespace-nowrap">{formatPesos(expense.amount_centavos)}</td>
            <td className="whitespace-nowrap"><LastReplacedCell category={expense.category} replacedDate={expense.replaced_date} /></td>
            <td><NotesCell expenseId={expense.id} notes={expense.notes || null} hasReceipt={Boolean(expense.receipt_object_path)} /></td>
            <td><ExpenseRowMenu expense={editable} units={activeUnits} isOwner={isOwner} /></td>
          </tr>;
        })}
      </DataTable>
    </div>
  </section>;
}
