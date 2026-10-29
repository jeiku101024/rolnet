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

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const profile = await requireApprovedSession();
  const isOwner = profile.role === "owner";
  const { edit } = await searchParams;
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const [{ data: categories }, { data: units }, { data: expenses }] = supabase ? await Promise.all([
    supabase.from("expense_categories").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("units").select("id, body_number, plate_number").is("deleted_at", null).order("body_number"),
    supabase.from("expenses").select("id, unit_id, category_id, expense_date, amount_centavos, notes, updated_at, receipt_object_path, units(body_number, plate_number), expense_categories(name)").is("deleted_at", null).order("expense_date", { ascending: false }).order("created_at", { ascending: false }).limit(50),
  ]) : [{ data: demoCategories }, { data: demoUnits }, { data: demoExpenses }];
  const editing = edit ? (expenses ?? []).find((expense) => expense.id === edit) as EditableExpense | undefined : undefined;
  return <section className="workspace"><PageHeader eyebrow="Operating costs" title="Expenses" description="Save costs in Philippine pesos. Receipt photos are optional but missing receipts stay visible." />
    <div className="mt-8 workspace-grid">
      <div><DataTable headers={["Date", "Category / unit", "Amount", "Receipt", "Actions"]} empty={<p className="p-6 text-muted">No expenses recorded yet.</p>}>{(expenses ?? []).map((expense) => <tr key={expense.id}>
        <td className="font-data">{expense.expense_date}</td>
        <td><p className="font-semibold">{one(expense.expense_categories)?.name ?? "Expense"}</p><p className="text-body-sm text-muted">Body {one(expense.units)?.body_number ?? "Unknown"}{expense.notes ? ` · ${expense.notes}` : ""}</p></td>
        <td className="font-data">{formatPesos(expense.amount_centavos)}</td>
        <td>{expense.receipt_object_path ? <SignedFileButton load={getReceiptUrl.bind(null, expense.id)} label="View receipt" /> : <StatusBadge label="Missing" tone="warning" />}</td>
        <td><div className="flex flex-wrap gap-2"><Link className="muted-link inline-flex min-h-11 items-center" href={`/expenses?edit=${expense.id}`}>Edit</Link>{isOwner ? <ArchiveButton action={softDeleteExpense.bind(null, expense.id)} confirmText="Archive this expense? It will be removed from totals and reports." /> : null}</div></td>
      </tr>)}</DataTable></div>
      <aside className="border-t border-rule pt-5">
        {editing ? <><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-section-title font-bold">Edit expense</h2><Link className="muted-link text-body-sm" href="/expenses">Cancel</Link></div><p className="mt-1 mb-4 text-body-sm text-muted">Change the details or attach a missing receipt.</p><ExpenseForm key={editing.id} categories={categories ?? []} units={units ?? []} expense={editing} /></>
          : <><h2 className="text-section-title font-bold">Add an expense</h2><p className="mt-1 mb-4 text-body-sm text-muted">{edit ? "That expense was not found in the latest 50; add a new one or reload." : "Missing receipts remain clearly flagged after saving."}</p><ExpenseForm categories={categories ?? []} units={units ?? []} /></>}
      </aside>
    </div>
  </section>;
}
