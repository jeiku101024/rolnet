import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { formatPesos } from "@/lib/money/centavos";
import { getReceiptUrl, softDeleteExpense } from "@/app/actions/expenses";
import { ExpenseForm, type EditableExpense } from "@/components/forms/expense-form";
import { ArchiveButton, SignedFileButton } from "@/components/forms/record-buttons";
import { demoCategories, demoExpenses, demoMode, demoUnits } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/feedback";
import { listHref, pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { loadListPage } from "@/lib/pagination/search-filter";
import { searchSpecs } from "@/lib/pagination/search-specs";
import { listView } from "@/components/ui/paged-list";

const expenseColumns = "id, unit_id, category_id, expense_date, amount_centavos, notes, updated_at, receipt_object_path, units(body_number, plate_number), expense_categories(name)";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const params = await searchParams;
  const edit = typeof params.edit === "string" ? params.edit : undefined;
  const request = parseListPage(params);
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const [{ data: categories }, { data: units }, result, { data: editRow }] = supabase ? await Promise.all([
    supabase.from("expense_categories").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("units").select("id, body_number, plate_number").is("deleted_at", null).order("body_number"),
    loadListPage(supabase, request, searchSpecs.expenses, (from, to, filter) => {
      let query = supabase.from("expenses").select(expenseColumns, { count: "exact" }).is("deleted_at", null);
      if (filter) query = query.or(filter);
      return query.order("expense_date", { ascending: false }).order("created_at", { ascending: false }).range(from, to);
    }),
    // The expense being edited may be on another page, so it is read on its own.
    edit && /^[0-9a-f-]{36}$/i.test(edit) ? supabase.from("expenses").select(expenseColumns).eq("id", edit).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
  ]) : [{ data: demoCategories }, { data: demoUnits }, pageRows(demoExpenses, request, (expense) => `${expense.expense_date} ${one(expense.expense_categories)?.name} ${one(expense.units)?.body_number} ${expense.notes}`), { data: null }];
  const expenses = result.rows;
  const list = listView("/expenses", params, request, result, { searchLabel: "Search expenses" });
  const editing = (editRow ?? (edit ? expenses.find((expense) => expense.id === edit) : undefined)) as EditableExpense | undefined;
  const editHref = (id: string) => listHref("/expenses", params, { edit: id });
  const cancelHref = listHref("/expenses", params, { edit: null });
  return <section className="workspace"><PageHeader eyebrow="Operating costs" title="Expenses" description="Save costs in Philippine pesos. Receipt photos are optional but missing receipts stay visible." />
    <div className="mt-8 workspace-grid">
      <div><DataTable list={list} headers={["Date", "Category / unit", "Amount", "Receipt", "Actions"]} empty={<p className="p-6 text-muted">No expenses recorded yet.</p>}>{expenses.map((expense) => <tr key={expense.id}>
        <td className="font-data">{expense.expense_date}</td>
        <td><p className="font-semibold">{one(expense.expense_categories)?.name ?? "Expense"}</p><p className="text-body-sm text-muted">Body {one(expense.units)?.body_number ?? "Unknown"}{expense.notes ? ` · ${expense.notes}` : ""}</p></td>
        <td className="font-data">{formatPesos(expense.amount_centavos)}</td>
        <td>{expense.receipt_object_path ? <SignedFileButton load={getReceiptUrl.bind(null, expense.id)} label="View receipt" /> : <StatusBadge label="Missing" tone="warning" />}</td>
        <td><div className="flex flex-wrap gap-2"><Link className="muted-link inline-flex min-h-11 items-center" href={editHref(expense.id)}>Edit</Link>{isOwner ? <ArchiveButton action={softDeleteExpense.bind(null, expense.id)} confirmText="Archive this expense? It will be removed from totals and reports." /> : null}</div></td>
      </tr>)}</DataTable></div>
      <aside className="border-t border-rule pt-5">
        {editing ? <><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-section-title font-bold">Edit expense</h2><Link className="muted-link text-body-sm" href={cancelHref}>Cancel</Link></div><p className="mt-1 mb-4 text-body-sm text-muted">Change the details or attach a missing receipt.</p><ExpenseForm key={editing.id} categories={categories ?? []} units={units ?? []} expense={editing} /></>
          : <><h2 className="text-section-title font-bold">Add an expense</h2><p className="mt-1 mb-4 text-body-sm text-muted">{edit ? "That expense was not found. It may have been archived; add a new one or reload." : "Missing receipts remain clearly flagged after saving."}</p><ExpenseForm categories={categories ?? []} units={units ?? []} /></>}
      </aside>
    </div>
  </section>;
}
