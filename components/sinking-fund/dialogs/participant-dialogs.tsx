"use client";

import { useState, type FormEvent } from "react";
import { archiveParticipant, renameParticipant } from "@/app/actions/sinking-fund";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, ValidationSummary } from "@/components/ui/form-field";
import { Field, useSfSubmit } from "@/components/sinking-fund/form-kit";
import { sfMessages } from "@/lib/sinking-fund/messages";
import type { SfParticipantSummary } from "@/lib/sinking-fund/types";

/** "Edit name": a linked participant's driver link is removed, so it asks first (spec section 15). */
export function EditNameDialog({ participant, open, onOpenChange }: { participant: SfParticipantSummary; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState(participant.name);
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const form = useSfSubmit(() => onOpenChange(false));
  const linked = Boolean(participant.driver_id);

  async function save() {
    await form.submit(() => renameParticipant({ id: participant.participant_id, name, expectedUpdatedAt: participant.updated_at }), () => sfMessages.nameUpdated);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError("Enter a name."); return; }
    setError(undefined);
    if (name.trim() === participant.name) { onOpenChange(false); return; }
    if (linked && !confirming) { setConfirming(true); return; }
    await save();
  }

  const shownError = error ?? form.fieldErrors.name;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title="Edit name">
      <form noValidate className="grid gap-4" onSubmit={onSubmit}>
        <Field label="Name" required htmlFor="sf-edit-name" error={shownError}>
          <Input id="sf-edit-name" value={name} onChange={(event) => { setName(event.target.value); setConfirming(false); }} autoComplete="off" aria-invalid={shownError ? true : undefined} />
        </Field>
        {confirming ? <p role="alert" className="border border-warn/30 bg-warn-soft p-3 text-body-sm text-warn">This participant is linked to a driver record. Changing the name removes that link. Save again to continue.</p> : null}
        <ValidationSummary message={form.failure} />
        <Button type="submit" disabled={form.pending}>{form.pending ? "Saving…" : confirming ? "Change name and remove link" : "Save name"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}

/** "Archive participant" (owner): only with ₱0 savings and no open or overdue loans, otherwise it says what to do first. */
export function ArchiveDialog({ participant, open, onOpenChange }: { participant: SfParticipantSummary; open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useSfSubmit(() => onOpenChange(false));
  const hasLoans = participant.loans_centavos > 0 || participant.balance_to_pay_centavos > 0;
  const hasSavings = participant.savings_centavos !== 0;
  const blocker = hasLoans ? "This participant has an open or overdue loan. Settle or close it first." : hasSavings ? "Total savings must be ₱0.00 before archiving. Record a savings withdrawal first." : null;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title={`Archive ${participant.name}?`} description="Archived participants are hidden from the views, forms, rankings, and distributions. Their history and past totals stay.">
      {blocker ? <p role="alert" className="border border-warn/30 bg-warn-soft p-3 text-body-sm text-warn">{blocker}</p> : null}
      <ValidationSummary message={form.failure} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="button" variant="destructive" disabled={Boolean(blocker) || form.pending}
          onClick={() => form.submit(() => archiveParticipant({ id: participant.participant_id, expectedUpdatedAt: participant.updated_at }), () => sfMessages.participantArchived)}>
          {form.pending ? "Saving…" : "Archive participant"}
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}
