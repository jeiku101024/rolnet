"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveSummary, archiveUnit } from "@/app/actions/units";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { roleLabel } from "@/lib/units/assignment-board";
import type { ArchiveSummary } from "@/lib/units/archive-summary";

/**
 * "Archive [unit]?" (feature 010, FR-033 to FR-035): what is tied to the unit, with counts. Cancel
 * has focus; Escape closes it; the alert dialog keeps focus inside. Mount it only while open, so each
 * opening loads fresh counts.
 */
export function ArchiveUnitDialog({ unit, open, onOpenChange }: { unit: { id: string; name: string; updatedAt: string }; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const toast = useToast();
  const cancel = useRef<HTMLButtonElement>(null);
  const [summary, setSummary] = useState<ArchiveSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    archiveSummary({ id: unit.id }).then((result) => {
      if (!live) return;
      if (result.ok) setSummary(result.data); else setError(result.message);
    }).catch((reason) => { if (live) setError(clientErrorMessage(reason)); });
    return () => { live = false; };
  }, [open, unit.id]);

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await archiveUnit({ id: unit.id, expectedUpdatedAt: unit.updatedAt });
      if (!result.ok) { setError(result.message); return; }
      onOpenChange(false);
      toast("Unit archived");
      router.refresh();
    } catch (reason) {
      setError(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  const rows: [string, string][] = summary ? [
    ["Driver assigned today", summary.todayDriver ? `${summary.todayDriver.driverName} (${roleLabel(summary.todayDriver.role)})` : "None"],
    ["Assignment records", String(summary.assignments)],
    ["Remittances", String(summary.remittances)],
    ["Expenses", String(summary.expenses)],
    ["Documents", String(summary.documents)],
    ["Audit history entries", String(summary.auditEntries)],
  ] : [];

  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent initialFocus={cancel} title={`Archive ${unit.name}?`}
      description={`${unit.name} will be hidden from the units list, daily assignments, and remittances. No records are deleted. Reports keep its data, and you can restore it anytime.`}>
      <div className="grid gap-2">
        <p className="text-body-sm font-semibold text-ink">Tied to this unit:</p>
        {summary ? <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-body-sm">
          {rows.map(([label, value]) => <div key={label} className="contents"><dt className="text-muted">{label}</dt><dd className="text-right font-data text-ink">{value}</dd></div>)}
        </dl> : error ? null : <p role="status" className="text-body-sm text-muted">Loading…</p>}
      </div>
      {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
      <AlertDialogFooter>
        <AlertDialogClose ref={cancel} render={<Button type="button" variant="outline" />}>Cancel</AlertDialogClose>
        <Button type="button" className="bg-danger text-surface hover:bg-danger/90" disabled={pending} onClick={confirm}>{pending ? "Archiving…" : "Archive unit"}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
