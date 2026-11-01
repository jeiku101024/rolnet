"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditExpenseDialog, type EditableExpense } from "@/components/expenses/expense-dialog";
import { DeleteExpenseDialog } from "@/components/expenses/delete-expense-dialog";
import type { ExpenseUnitOption } from "@/components/expenses/expense-form-fields";

/**
 * An expense row's 3-dot menu (feature 011, FR-027, FR-028): Edit, and Delete for the owner. Base UI
 * positions it so it flips upward near the bottom of the screen; arrows, Enter and Escape work.
 */
export function ExpenseRowMenu({ expense, units, isOwner }: { expense: EditableExpense; units: ExpenseUnitOption[]; isOwner: boolean }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger className="touch-target inline-flex w-11 items-center justify-center rounded-md text-ink hover:bg-brand-soft" aria-label="Expense options"><MoreHorizontal aria-hidden="true" size={18} /></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setEditing(true)}>Edit</DropdownMenuItem>
        {isOwner
          ? <DropdownMenuItem className="text-danger" onClick={() => setDeleting(true)}>Delete</DropdownMenuItem>
          : <DropdownMenuItem disabled title="Only the owner can delete expenses">Delete (owner only)</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    {editing ? <EditExpenseDialog expense={expense} units={units} open onOpenChange={setEditing} /> : null}
    {deleting && isOwner ? <DeleteExpenseDialog expense={expense} open onOpenChange={setDeleting} /> : null}
  </>;
}
