"use client";

import { FormField, Input, Select, Textarea } from "@/components/ui/form-field";
import { expenseCategoryLabels, expenseCategoryOptions, isMainCategory, mainCategoryFor, type ExpenseCategory } from "@/lib/expenses/categories";
import { fleetToday } from "@/lib/dates/fleet-date";
import { parsePositiveCentavos } from "@/lib/money/centavos";
import { expenseUpdateSchema } from "@/lib/validation/expenses";

export type ExpenseUnitOption = { id: string; body_number: string; plate_number: string };

/** Form state for the Add and Edit expense modal (contracts/ui.md "Fields"). */
export type ExpenseFormValues = {
  unitId: string;
  category: ExpenseCategory | "";
  customCategory: string;
  expenseDate: string;
  replacedDate: string;
  /** False until the user edits Date replaced; until then it follows the expense date (FR-019). */
  replacedTouched: boolean;
  amount: string;
  notes: string;
};

export type ExpenseFormField = "unitId" | "category" | "customCategory" | "expenseDate" | "replacedDate" | "amountCentavos" | "notes";
export type ExpenseFormErrors = Partial<Record<ExpenseFormField, string>>;

export function emptyExpenseValues(): ExpenseFormValues {
  const today = fleetToday();
  return { unitId: "", category: "", customCategory: "", expenseDate: today, replacedDate: today, replacedTouched: false, amount: "", notes: "" };
}

export function expenseValuesFrom(expense: { unit_id: string; category: ExpenseCategory; custom_category: string | null; expense_date: string; replaced_date: string | null; amount_centavos: number; notes: string | null }): ExpenseFormValues {
  return {
    unitId: expense.unit_id,
    category: expense.category,
    customCategory: expense.custom_category ?? "",
    expenseDate: expense.expense_date,
    replacedDate: expense.replaced_date ?? expense.expense_date,
    replacedTouched: Boolean(expense.replaced_date && expense.replaced_date !== expense.expense_date),
    amount: expense.amount_centavos ? (expense.amount_centavos / 100).toFixed(2) : "",
    notes: expense.notes ?? "",
  };
}

/**
 * Checks the form with the same Zod rules the server uses and returns the action input.
 * Only the field that applies to the category is sent (Category name for Others, Date replaced otherwise).
 */
export function readExpenseForm(values: ExpenseFormValues, archivedUnitId?: string) {
  const errors: ExpenseFormErrors = {};
  let amountCentavos = 0;
  try {
    amountCentavos = parsePositiveCentavos(values.amount);
  } catch (reason) {
    errors.amountCentavos = reason instanceof Error ? reason.message : "Enter an amount greater than ₱0.00.";
  }
  const others = values.category === "others";
  const input = {
    unitId: values.unitId,
    category: values.category,
    customCategory: others ? values.customCategory : undefined,
    expenseDate: values.expenseDate,
    replacedDate: values.category && !others ? values.replacedDate : undefined,
    amountCentavos: amountCentavos || 1,
    notes: values.notes.trim() || undefined,
  };
  const parsed = expenseUpdateSchema.safeParse({ ...input, expectedUpdatedAt: "check" });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "") as ExpenseFormField;
      if (key && key !== "amountCentavos" && !errors[key]) errors[key] = issue.message;
    }
  }
  if (!values.expenseDate) errors.expenseDate = "Enter the expense date.";
  if (archivedUnitId && values.unitId === archivedUnitId) errors.unitId = "This unit is archived. Choose another unit.";
  return { errors, input: { ...input, amountCentavos } };
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-xs font-normal text-danger">{message}</span> : null;
}

/** The Add/Edit expense fields. Switching category swaps Category name and Date replaced in place (FR-020). */
export function ExpenseFormFields({ values, errors, units, archivedUnit, hasReceipt, onChange, onCategoryChange }: {
  values: ExpenseFormValues;
  errors: ExpenseFormErrors;
  units: ExpenseUnitOption[];
  /** The saved unit when it has since been archived: shown, but it can't be chosen again. */
  archivedUnit?: ExpenseUnitOption;
  hasReceipt?: boolean;
  onChange: (next: Partial<ExpenseFormValues>) => void;
  /** Lets the Edit modal confirm before a main category becomes Others (FR-024). */
  onCategoryChange?: (category: ExpenseCategory | "") => void;
}) {
  const others = values.category === "others";
  const looksLike = others ? mainCategoryFor(values.customCategory) : null;
  const today = fleetToday();
  const invalid = (field: ExpenseFormField) => Boolean(errors[field]) || undefined;
  const changeCategory = (category: ExpenseCategory | "") => (onCategoryChange ? onCategoryChange(category) : onChange({ category }));
  return <div className="grid gap-4">
    <FormField label="Unit" required>
      <Select name="unitId" value={values.unitId} aria-invalid={invalid("unitId")} onChange={(event) => onChange({ unitId: event.target.value })}>
        <option value="">Choose a unit</option>
        {archivedUnit ? <option value={archivedUnit.id} disabled>Body {archivedUnit.body_number} · {archivedUnit.plate_number} (archived)</option> : null}
        {units.map((unit) => <option value={unit.id} key={unit.id}>Body {unit.body_number} · {unit.plate_number}</option>)}
      </Select>
      <FieldError message={errors.unitId} />
    </FormField>
    <FormField label="Category" required>
      <Select name="category" value={values.category} aria-invalid={invalid("category")} onChange={(event) => changeCategory(event.target.value as ExpenseCategory | "")}>
        <option value="">Choose a category</option>
        {expenseCategoryOptions.map((category) => <option value={category} key={category}>{expenseCategoryLabels[category]}</option>)}
      </Select>
      <FieldError message={errors.category} />
    </FormField>
    {others ? <FormField label="Category name" required hint={looksLike ? `This looks like ${expenseCategoryLabels[looksLike]}. Choose it from Category to track Last Replaced.` : "For example: Brake pads"}>
      <Input name="customCategory" maxLength={80} value={values.customCategory} aria-invalid={invalid("customCategory")} onChange={(event) => onChange({ customCategory: event.target.value })} />
      <FieldError message={errors.customCategory} />
    </FormField> : null}
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Expense date" required>
        <Input name="expenseDate" type="date" max={today} value={values.expenseDate} aria-invalid={invalid("expenseDate")}
          onChange={(event) => onChange(values.replacedTouched ? { expenseDate: event.target.value } : { expenseDate: event.target.value, replacedDate: event.target.value })} />
        <FieldError message={errors.expenseDate} />
      </FormField>
      {isMainCategory(values.category) ? <FormField label="Date replaced" required>
        <Input name="replacedDate" type="date" max={today} value={values.replacedDate} aria-invalid={invalid("replacedDate")} onChange={(event) => onChange({ replacedDate: event.target.value, replacedTouched: true })} />
        <FieldError message={errors.replacedDate} />
      </FormField> : null}
    </div>
    <FormField label="Amount (₱)" required hint="More than ₱0.00, for example 250 or 250.50.">
      <Input name="amount" inputMode="decimal" placeholder="0.00" value={values.amount} aria-invalid={invalid("amountCentavos")} onChange={(event) => onChange({ amount: event.target.value })} />
      <FieldError message={errors.amountCentavos} />
    </FormField>
    <FormField label="Notes">
      <Textarea name="notes" maxLength={1000} value={values.notes} aria-invalid={invalid("notes")} onChange={(event) => onChange({ notes: event.target.value })} />
      <FieldError message={errors.notes} />
    </FormField>
    <FormField label={hasReceipt ? "Replace receipt photo (optional)" : "Receipt photo (optional)"} hint={hasReceipt ? "A receipt is attached. Choose a new photo to replace it." : "JPG, PNG or WebP. Photos are compressed before upload."}>
      <Input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" />
    </FormField>
  </div>;
}
