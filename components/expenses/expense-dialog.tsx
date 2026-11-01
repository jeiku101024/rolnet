"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createExpense, updateExpense } from "@/app/actions/expenses";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { ValidationSummary } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { isMainCategory, type ExpenseCategory } from "@/lib/expenses/categories";
import { attachReceipt, prepareChosenReceipt } from "@/components/expenses/receipt";
import { emptyExpenseValues, expenseValuesFrom, ExpenseFormFields, readExpenseForm, type ExpenseFormErrors, type ExpenseFormValues, type ExpenseUnitOption } from "@/components/expenses/expense-form-fields";

export type EditableExpense = {
  id: string;
  unit_id: string;
  category: ExpenseCategory;
  custom_category: string | null;
  expense_date: string;
  replaced_date: string | null;
  amount_centavos: number;
  notes: string | null;
  updated_at: string;
  receipt_object_path: string | null;
  units: { body_number: string; plate_number: string } | null;
};

type Mode = { kind: "add" } | { kind: "edit"; expense: EditableExpense };

/** The modal form for both Add and Edit (contracts/ui.md). Mounted only while open, so each opening starts fresh. */
function ExpenseDialogForm({ mode, units, onDone }: { mode: Mode; units: ExpenseUnitOption[]; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const saved = mode.kind === "edit" ? mode.expense : null;
  const [values, setValues] = useState<ExpenseFormValues>(() => (saved ? expenseValuesFrom(saved) : emptyExpenseValues()));
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [failure, setFailure] = useState<string | undefined>();
  const [stale, setStale] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmOthers, setConfirmOthers] = useState(false);
  // One idempotency key per opening, reused by retries until the save succeeds (FR-026).
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  // After a save whose receipt upload failed, retries continue from the saved record.
  const savedRef = useRef<{ id: string; updatedAt: string } | null>(saved ? { id: saved.id, updatedAt: saved.updated_at } : null);
  const archivedUnit = saved && saved.units && !units.some((unit) => unit.id === saved.unit_id) ? { id: saved.unit_id, ...saved.units } : undefined;

  const change = (next: Partial<ExpenseFormValues>) => setValues((current) => ({ ...current, ...next }));

  function changeCategory(category: ExpenseCategory | "") {
    // FR-024: moving a saved main-category expense to Others removes its Last Replaced date; ask first.
    if (saved && isMainCategory(saved.category) && category === "others" && values.category !== "others") {
      setConfirmOthers(true);
      return;
    }
    change({ category });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const { errors: found, input } = readExpenseForm(values, archivedUnit?.id);
    setErrors(found);
    setFailure(undefined);
    setStale(false);
    if (Object.keys(found).length) return;
    const file = new FormData(event.currentTarget).get("receipt");
    setPending(true);
    try {
      const { receipt, problem } = await prepareChosenReceipt(file instanceof File ? file : null);
      if (problem) { setFailure(problem); return; }
      const result = savedRef.current && mode.kind === "edit"
        ? await updateExpense(savedRef.current.id, { ...input, expectedUpdatedAt: savedRef.current.updatedAt })
        : await createExpense({ ...input, idempotencyKey });
      if (!result.ok) {
        if (result.code === "STALE_RECORD") setStale(true);
        if (result.fieldErrors) setErrors(Object.fromEntries(Object.entries(result.fieldErrors).map(([key, messages]) => [key, messages[0]])) as ExpenseFormErrors);
        setFailure(result.message);
        return;
      }
      savedRef.current = { id: result.data.id, updatedAt: result.data.updatedAt };
      if (receipt) {
        const attached = await attachReceipt(result.data.id, receipt);
        if (!attached.ok) {
          router.refresh();
          setFailure(`The expense was saved, but the receipt was not attached: ${attached.message} Save again to retry the receipt.`);
          return;
        }
      }
      onDone();
      toast(mode.kind === "edit" ? "Expense updated" : "Expense added");
      router.refresh();
    } catch (reason) {
      setFailure(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return <>
    <form noValidate className="grid gap-4" onSubmit={submit}>
      <ExpenseFormFields values={values} errors={errors} units={units} archivedUnit={archivedUnit} hasReceipt={Boolean(saved?.receipt_object_path)} onChange={change} onCategoryChange={changeCategory} />
      <ValidationSummary message={failure} />
      {stale ? <Button type="button" variant="outline" onClick={() => { router.refresh(); onDone(); }}>Reload</Button> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : mode.kind === "edit" ? "Save changes" : "Save expense"}</Button>
    </form>
    <RemoveLastReplacedDialog open={confirmOthers} onCancel={() => setConfirmOthers(false)} onContinue={() => { setConfirmOthers(false); change({ category: "others" }); }} />
  </>;
}

function RemoveLastReplacedDialog({ open, onCancel, onContinue }: { open: boolean; onCancel: () => void; onContinue: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  return <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
    <AlertDialogContent title="Remove Last Replaced date?" description="This removes the Last Replaced date." initialFocus={cancel}>
      <AlertDialogFooter>
        <AlertDialogClose ref={cancel} render={<Button type="button" variant="outline" />}>Cancel</AlertDialogClose>
        <Button type="button" onClick={onContinue}>Continue</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

/** "Add expense" beside Filters opens the expense form in a modal (feature 011, FR-005, FR-018). */
export function AddExpenseDialog({ units }: { units: ExpenseUnitOption[] }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" />}><Plus aria-hidden="true" size={16} />Add expense</DialogTrigger>
    <DialogContent title="Add expense">
      {open ? <ExpenseDialogForm mode={{ kind: "add" }} units={units} onDone={() => setOpen(false)} /> : null}
    </DialogContent>
  </Dialog>;
}

/** "Edit" in the row menu opens the same form, pre-filled (FR-018). Controlled by the row menu. */
export function EditExpenseDialog({ expense, units, open, onOpenChange }: { expense: EditableExpense; units: ExpenseUnitOption[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title="Edit expense">
      {open ? <ExpenseDialogForm mode={{ kind: "edit", expense }} units={units} onDone={() => onOpenChange(false)} /> : null}
    </DialogContent>
  </Dialog>;
}
