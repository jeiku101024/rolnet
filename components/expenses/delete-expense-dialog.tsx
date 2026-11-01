"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteExpense } from "@/app/actions/expenses";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { categoryText } from "@/lib/expenses/categories";
import { formatPesos } from "@/lib/money/centavos";
import { formatShortDate } from "@/lib/dates/fleet-date";
import type { EditableExpense } from "@/components/expenses/expense-dialog";

/**
 * "Delete this expense?" (feature 011, FR-029 to FR-031). Owner only. Cancel has focus; the delete
 * is a soft delete with a stale check, and the database audits it with the deleted values.
 */
export function DeleteExpenseDialog({ expense, open, onOpenChange }: { expense: EditableExpense; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const toast = useToast();
  const cancel = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await deleteExpense(expense.id, expense.updated_at);
      if (!result.ok) { setError(result.message); return; }
      onOpenChange(false);
      toast("Expense deleted");
      router.refresh();
    } catch (reason) {
      setError(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  const rows: [string, string][] = [
    ["Date", formatShortDate(expense.expense_date)],
    ["Unit", expense.units ? `Body ${expense.units.body_number}` : "Unit"],
    ["Category", categoryText(expense)],
    ["Amount", formatPesos(expense.amount_centavos)],
  ];

  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent initialFocus={cancel} title="Delete this expense?" description="This permanently removes the expense and changes report totals for that period.">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-body-sm">
        {rows.map(([label, value]) => <div key={label} className="contents"><dt className="text-muted">{label}</dt><dd className="min-w-0 truncate text-right font-data text-ink">{value}</dd></div>)}
      </dl>
      {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
      <AlertDialogFooter>
        <AlertDialogClose ref={cancel} render={<Button type="button" variant="outline" />}>Cancel</AlertDialogClose>
        <Button type="button" className="bg-danger text-surface hover:bg-danger/90" disabled={pending} onClick={confirm}>{pending ? "Deleting…" : "Delete expense"}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
