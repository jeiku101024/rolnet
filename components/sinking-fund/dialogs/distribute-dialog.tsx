"use client";

import { useState, type FormEvent } from "react";
import { distributeInterest } from "@/app/actions/sinking-fund";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea, ValidationSummary } from "@/components/ui/form-field";
import { Field, useSfSubmit } from "@/components/sinking-fund/form-kit";
import { formatPesos } from "@/lib/money/centavos";
import { formatDistributionToast } from "@/lib/sinking-fund/messages";
import { shareOf } from "@/lib/sinking-fund/rules";
import type { SfParticipantSummary } from "@/lib/sinking-fund/types";

/**
 * "Distribute interest" (spec section 9), owner only. Every active participant starts ticked; each ticked
 * participant gets the same share, rounded down to the centavo, and the remainder stays in the fund.
 */
export function DistributeDialog({ participants, availableCentavos, today, open, onOpenChange }: { participants: SfParticipantSummary[]; availableCentavos: number; today: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(participants.map((participant) => participant.participant_id)));
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const form = useSfSubmit(() => onOpenChange(false));
  const { share, total, remainder } = shareOf(availableCentavos, ticked.size);
  const canConfirm = share > 0 && ticked.size > 0 && !form.pending;

  function toggle(id: string, on: boolean) {
    setTicked((current) => { const next = new Set(current); if (on) next.add(id); else next.delete(id); return next; });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canConfirm) return;
    await form.submit(() => distributeInterest({ date, participantIds: [...ticked], notes: notes || undefined, idempotencyKey: form.key }), (data) => formatDistributionToast(data.totalCentavos, data.participants));
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title="Distribute interest" description="Everyone ticked gets the same share, added to their savings.">
      <form noValidate className="grid gap-4" onSubmit={onSubmit}>
        <p className="text-body-sm">Available: <strong data-testid="sf-available">{formatPesos(availableCentavos)}</strong></p>
        <fieldset className="grid gap-1">
          <legend className="text-sm font-medium text-ink">Participants</legend>
          <ul className="max-h-48 overflow-y-auto rounded-md border border-rule">
            {participants.map((participant) => <li key={participant.participant_id}>
              <label className="touch-target flex items-center gap-3 px-3 text-body-sm">
                <Checkbox checked={ticked.has(participant.participant_id)} onCheckedChange={(checked) => toggle(participant.participant_id, checked)} />
                {participant.name}
              </label>
            </li>)}
          </ul>
        </fieldset>
        <div className="grid gap-1 rounded-md bg-canvas p-3 text-body-sm" role="status">
          <p>Each participant gets <strong data-testid="sf-share">{formatPesos(share)}</strong></p>
          {remainder > 0 && ticked.size > 0 ? <p className="text-muted">{formatPesos(remainder)} stays in the fund.</p> : null}
          {availableCentavos <= 0 ? <p className="text-muted">There is no interest to distribute yet.</p> : null}
          {availableCentavos > 0 && ticked.size > 0 && share === 0 ? <p className="text-danger">The fund is too small to share among {ticked.size} participants.</p> : null}
        </div>
        <Field label="Date" htmlFor="sf-dist-date" hint={date !== today ? "The exact amount is worked out for the date you pick." : undefined}>
          <Input id="sf-dist-date" type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="sf-dist-notes">
          <Textarea id="sf-dist-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="For example, 2026 year-end" />
        </Field>
        <ValidationSummary message={form.failure} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={!canConfirm}>{form.pending ? "Saving…" : `Distribute ${formatPesos(total)}`}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
