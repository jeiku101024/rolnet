"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { getReceiptUrl } from "@/app/actions/expenses";
import { StatusBadge } from "@/components/ui/feedback";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { categoryText, type ExpenseCategory } from "@/lib/expenses/categories";
import { formatShortDate } from "@/lib/dates/fleet-date";

function Truncated({ text, className = "" }: { text: string; className?: string }) {
  return <Tooltip>
    <TooltipTrigger render={<span tabIndex={0} className={`block min-w-0 truncate ${className}`} />}>{text}</TooltipTrigger>
    <TooltipContent>{text}</TooltipContent>
  </Tooltip>;
}

/** Category column (FR-012): the main label, or the typed name with an "Others" tag; plus "Needs review". */
export function CategoryCell({ expense }: { expense: { category: ExpenseCategory; custom_category: string | null; needs_review: boolean } }) {
  const others = expense.category === "others";
  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    {others ? <Truncated text={categoryText(expense)} className="max-w-40 font-semibold text-ink" /> : <span className="font-semibold text-ink">{categoryText(expense)}</span>}
    {others ? <span className="status-badge bg-canvas text-muted">Others</span> : null}
    {expense.needs_review ? <StatusBadge label="Needs review" tone="warning" /> : null}
  </div>;
}

/** Last Replaced column (FR-014): the date replaced, or "N/A" for Others. */
export function LastReplacedCell({ category, replacedDate }: { category: ExpenseCategory; replacedDate: string | null }) {
  if (category === "others" || !replacedDate) return <span className="text-muted">N/A</span>;
  return <span className="font-data">{formatShortDate(replacedDate)}</span>;
}

/** Notes column (FR-015): a receipt button when one is attached, then the notes cut off with a tooltip. */
export function NotesCell({ expenseId, notes, hasReceipt }: { expenseId: string; notes: string | null; hasReceipt: boolean }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function openReceipt() {
    setPending(true);
    setError("");
    const opened = window.open("", "_blank");
    try {
      const result = await getReceiptUrl(expenseId);
      if (!result.ok) { opened?.close(); setError(result.message); return; }
      if (opened) { opened.opener = null; opened.location.href = result.data.url; } else window.location.assign(result.data.url);
    } catch (reason) {
      opened?.close();
      setError(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }
  return <div className="grid min-w-0 gap-1">
    <div className="flex min-w-0 items-center gap-2">
      {hasReceipt ? <button type="button" aria-label="View receipt" disabled={pending} onClick={openReceipt} className="touch-target inline-flex w-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-brand-soft"><Paperclip aria-hidden="true" size={16} /></button> : null}
      {notes ? <Truncated text={notes} className="max-w-56 text-muted" /> : hasReceipt ? null : <span className="text-muted">—</span>}
    </div>
    {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
  </div>;
}
