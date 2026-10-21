import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPesos } from "@/lib/money/centavos";
import { ExpenseForm } from "@/components/forms/expense-form";
import { demoCategories, demoExpenses, demoMode, demoUnits } from "@/lib/demo/mode";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/feedback";

export default async function ExpensesPage() {
  await requireApprovedSession();
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const [{ data: categories }, { data: units }, { data: expenses }] = supabase ? await Promise.all([supabase.from("expense_categories").select("id, name").is("deleted_at", null).order("name"), supabase.from("units").select("id, body_number, plate_number").is("deleted_at", null).order("body_number"), supabase.from("expenses").select("id, expense_date, amount_centavos, notes, receipt_object_path, units(body_number, plate_number), expense_categories(name)").is("deleted_at", null).order("expense_date", { ascending: false }).limit(50)]) : [{ data: demoCategories }, { data: demoUnits }, { data: demoExpenses }];
  return <section className="workspace"><PageHeader eyebrow="Operating costs" title="Expenses" description="Save costs in Philippine pesos. Receipt photos are optional but missing receipts stay visible." /><div className="mt-8 workspace-grid"><div><DataTable headers={["Date", "Category / unit", "Amount", "Receipt"]} empty={<p className="p-6 text-muted">No expenses recorded yet.</p>}>{(expenses ?? []).map((expense) => <tr key={expense.id}><td className="font-data">{expense.expense_date}</td><td><p className="font-semibold">{(expense.expense_categories as { name: string }[] | null)?.[0]?.name ?? "Expense"}</p><p className="text-body-sm text-muted">Body {(expense.units as { body_number: string }[] | null)?.[0]?.body_number ?? "Unknown"}</p></td><td className="font-data">{formatPesos(expense.amount_centavos)}</td><td><StatusBadge label={expense.receipt_object_path ? "Attached" : "Missing"} tone={expense.receipt_object_path ? "success" : "warning"} /></td></tr>)}</DataTable></div><aside className="border-t border-rule pt-5"><h2 className="text-section-title font-bold">Add an expense</h2><p className="mt-1 mb-4 text-body-sm text-muted">Missing receipts remain clearly flagged after saving.</p><ExpenseForm categories={categories ?? []} units={units ?? []} /></aside></div></section>;
}
