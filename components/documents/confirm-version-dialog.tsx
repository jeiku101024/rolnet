"use client";

import { useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { clientErrorMessage } from "@/components/forms/use-action-form";

// Feature 013 (FR-037, FR-038, FR-041, FR-043, contracts/ui.md): one confirmation for every version
// change. Cancel returns to whatever opened it.

export type ConfirmVariant = "revert-previous" | "revert-remove" | "restore" | "bring-back-swap" | "bring-back-recreate";
export interface ConfirmFile { name: string; expiresOn: string }

const copy: Record<ConfirmVariant, { title: string; text: string; confirm: string; rows: [string, string?] }> = {
  "revert-previous": {
    title: "Revert to the previous version?",
    text: "The current file will be replaced by the previous one. The reverted file is kept for 30 days and can be brought back from Recently reverted. The history stays in the activity log.",
    confirm: "Revert upload", rows: ["Current file", "Will be restored"],
  },
  "revert-remove": {
    title: "Remove this upload?",
    text: "This is the first upload, so reverting removes the document. The file is kept for 30 days and can be brought back from Recently reverted. The action stays in the activity log.",
    confirm: "Remove upload", rows: ["File"],
  },
  restore: {
    title: "Restore this version?",
    text: "The selected version becomes the current file. The current file moves to the history, so nothing is lost. The status is recalculated and may show as Expired.",
    confirm: "Restore version", rows: ["Will become current", "Moves to history"],
  },
  "bring-back-swap": {
    title: "Bring back this file?",
    text: "The file becomes the current file. The current file moves to the history, so nothing is lost. The status is recalculated and may show as Expired.",
    confirm: "Bring back", rows: ["Will become current", "Moves to history"],
  },
  "bring-back-recreate": {
    title: "Bring back this document?",
    text: "The document returns with its stored file, number, issued date and expiry.",
    confirm: "Bring back", rows: ["File"],
  },
};

export function ConfirmVersionDialog({ variant, first, second, onCancel, onConfirm }: {
  variant: ConfirmVariant | null;
  first?: ConfirmFile;
  second?: ConfirmFile;
  onCancel: () => void;
  /** Returns an error message to show, or null when done. */
  onConfirm: () => Promise<string | null>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = variant ? copy[variant] : null;
  const files = [first, second];
  return <AlertDialog open={Boolean(variant)} onOpenChange={(next) => { if (!next && !pending) { setError(null); onCancel(); } }}>
    {text ? <AlertDialogContent title={text.title} description={text.text}>
      <dl className="grid gap-2 rounded-md border border-rule p-3">
        {text.rows.map((label, index) => (label && files[index] ? <div key={label} className="grid gap-0.5">
          <dt className="text-label font-bold text-muted">{label}</dt>
          <dd className="min-w-0 break-words font-data text-body-sm text-ink">{files[index]!.name} · expires {files[index]!.expiresOn}</dd>
        </div> : null))}
      </dl>
      {error ? <p className="text-body-sm text-danger" role="alert">{error}</p> : null}
      <AlertDialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={() => { setError(null); onCancel(); }}>Cancel</Button>
        <Button type="button" variant={variant?.startsWith("revert") ? "destructive" : "default"} disabled={pending} onClick={async () => {
          setPending(true);
          setError(null);
          try { setError(await onConfirm()); } catch (reason) { setError(clientErrorMessage(reason)); } finally { setPending(false); }
        }}>{pending ? "Working…" : text.confirm}</Button>
      </AlertDialogFooter>
    </AlertDialogContent> : null}
  </AlertDialog>;
}
