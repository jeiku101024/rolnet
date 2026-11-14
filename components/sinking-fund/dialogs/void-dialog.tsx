"use client";

import { useState, type FormEvent } from "react";
import { voidDistribution, voidTransaction } from "@/app/actions/sinking-fund";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea, ValidationSummary } from "@/components/ui/form-field";
import { Field, useSfSubmit } from "@/components/sinking-fund/form-kit";
import { sfMessages } from "@/lib/sinking-fund/messages";

export type VoidTarget = { kind: "transaction" | "distribution"; id: string; updatedAt: string; summary: string };

/**
 * "Void transaction" / "Void distribution" (spec section 15), owner only: asks for a reason, marks the entry voided,
 * and recalculates every total as if it never happened. The database blocks a void that would make savings or the
 * Interest fund negative on any date and says why; that message is shown here.
 */
export function VoidDialog({ target, open, onOpenChange }: { target: VoidTarget; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const form = useSfSubmit(() => onOpenChange(false));
  const noun = target.kind === "distribution" ? "distribution" : "transaction";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const clean = reason.trim();
    if (clean.length < 3 || clean.length > 300) { setError("Give a reason of 3 to 300 characters."); return; }
    setError(undefined);
    const input = { id: target.id, reason: clean, expectedUpdatedAt: target.updatedAt };
    await form.submit(() => (target.kind === "distribution" ? voidDistribution(input) : voidTransaction(input)), () => (target.kind === "distribution" ? sfMessages.distributionVoided : sfMessages.transactionVoided));
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title={`Void this ${noun}?`} description={target.kind === "distribution"
      ? "Its interest shares and year-end closes are voided together, everyone's savings come back, and the totals are recalculated as if it never happened."
      : "It stays in the history marked Voided, and the totals are recalculated as if it never happened."}>
      <form noValidate className="grid gap-4" onSubmit={onSubmit}>
        <p className="rounded-md bg-canvas p-3 text-body-sm">{target.summary}</p>
        <Field label="Reason" required htmlFor="sf-void-reason" error={error}>
          <Textarea id="sf-void-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} aria-invalid={error ? true : undefined} />
        </Field>
        <ValidationSummary message={form.failure} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="destructive" disabled={form.pending}>{form.pending ? "Saving…" : `Void ${noun}`}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
