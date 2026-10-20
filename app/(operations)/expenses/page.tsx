import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPesos } from "@/lib/money/centavos";
import { ExpenseForm } from "@/components/forms/expense-form";
import { demoCategories, demoExpenses, demoMode, demoUnits } from "@/lib/demo/mode";

export default async function ExpensesPage() {
  await requireApprovedSession();
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const [{ data: categories }, { data: units }, { data: expenses }] = supabase ? await Promise.all([
    supabase.from("expense_categories").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("units").select("id, body_number, plate_number").is("deleted_at", null).order("body_number"),
    supabase.from("expenses").select("id, expense_date, amount_centavos, notes, receipt_object_path, units(body_number, plate_number), expense_categories(name)").is("deleted_at", null).order("expense_date", { ascending: false }).limit(50),
  ]) : [{ data: demoCategories }, { data: demoUnits }, { data: demoExpenses }];
  return <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6"><div><p className="text-sm font-medium text-blue-700">Operating costs</p><h1 className="mt-1 text-2xl font-semibold">Expenses</h1><p className="mt-2 text-sm text-slate-600">Save costs in Philippine pesos. Receipt photos are optional but missing receipts stay visible.</p></div><ExpenseForm categories={categories ?? []} units={units ?? []} /><div><h2 className="text-lg font-semibold">Recent expenses</h2><ul className="mt-3 space-y-3">{(expenses ?? []).map((expense) => <li key={expense.id} className="rounded-lg border bg-white p-4"><div className="flex items-center justify-between gap-4"><span className="font-medium">{(expense.expense_categories as { name: string }[] | null)?.[0]?.name ?? "Expense"}</span><span className="font-semibold">{formatPesos(expense.amount_centavos)}</span></div><p className="mt-1 text-sm text-slate-600">{expense.expense_date} · Body {(expense.units as { body_number: string }[] | null)?.[0]?.body_number ?? "Unknown"}</p><p className="mt-2 text-xs font-medium text-amber-700">{expense.receipt_object_path ? "Receipt attached" : "Receipt missing"}</p></li>)}</ul></div></section>;
}
