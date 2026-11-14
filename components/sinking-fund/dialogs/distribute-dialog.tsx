"use client";

import { useMemo, useState, type FormEvent } from "react";
import { distributeInterest } from "@/app/actions/sinking-fund";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea, ValidationSummary } from "@/components/ui/form-field";
import { Field, useSfSubmit } from "@/components/sinking-fund/form-kit";
import { formatPesos } from "@/lib/money/centavos";
import { distributeWarning, formatDistributionToast } from "@/lib/sinking-fund/messages";
import { proportionalShares } from "@/lib/sinking-fund/rules";
import type { SfLoan, SfParticipantSummary } from "@/lib/sinking-fund/types";

/**
 * "Distribute interest" (feature 016), owner only. The Interest fund is shared in proportion to savings:
 * each ticked participant gets floor(fund x their savings / the ticked participants' savings), and the leftover
 * stays in the fund. Confirming also closes the year: ended totals are saved and every ticked participant starts
 * again from ₱0.00. A ticked participant with an unpaid loan blocks it until the loan is settled or they are unticked.
 */
export function DistributeDialog({ participants, openLoans, availableCentavos, today, open, onOpenChange }: { participants: SfParticipantSummary[]; openLoans: SfLoan[]; availableCentavos: number; today: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(participants.map((participant) => participant.participant_id)));
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const form = useSfSubmit(() => onOpenChange(false));
  const withLoans = useMemo(() => new Set(openLoans.map((loan) => loan.participant_id)), [openLoans]);
  const result = useMemo(
    () => proportionalShares(availableCentavos, participants.filter((participant) => ticked.has(participant.participant_id)).map((participant) => ({ id: participant.participant_id, savingsCentavos: participant.savings_centavos }))),
    [availableCentavos, participants, ticked],
  );
  const blocked = participants.filter((participant) => ticked.has(participant.participant_id) && withLoans.has(participant.participant_id));
  const canConfirm = result.total > 0 && ticked.size > 0 && blocked.length === 0 && !form.pending;

  function toggle(id: string, on: boolean) {
    setTicked((current) => { const next = new Set(current); if (on) next.add(id); else next.delete(id); return next; });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canConfirm) return;
    await form.submit(
      () => distributeInterest({ date, participantIds: [...ticked], notes: notes || undefined, expectedTotalCentavos: result.total, idempotencyKey: form.key }),
      (data) => formatDistributionToast(data.totalCentavos, data.shareCount),
    );
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title="Distribute interest" description="Shares follow each participant's savings. Confirming also closes the year.">
      <form noValidate className="grid gap-4" onSubmit={onSubmit}>
        <p className="text-body-sm">Available: <strong data-testid="sf-available">{formatPesos(availableCentavos)}</strong></p>
        <fieldset className="grid gap-1">
          <legend className="text-sm font-medium text-ink">Participants</legend>
          <ul className="max-h-64 overflow-y-auto rounded-md border border-rule" data-testid="sf-distribute-list">
            {participants.map((participant) => {
              const on = ticked.has(participant.participant_id);
              const hasLoan = withLoans.has(participant.participant_id);
              const share = result.shares.get(participant.participant_id) ?? 0;
              return <li key={participant.participant_id} className="border-b border-rule last:border-b-0">
                <label className="touch-target flex items-start gap-3 px-3 py-2 text-body-sm">
                  <Checkbox className="mt-1" checked={on} onCheckedChange={(checked) => toggle(participant.participant_id, checked)} />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="min-w-0 truncate font-semibold">{participant.name}</span>
                      <span className="font-data text-muted">Savings {formatPesos(participant.savings_centavos)}</span>
                    </span>
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-label">
                      {hasLoan ? <span className="font-semibold text-danger">Has an unpaid loan</span>
                        : participant.savings_centavos <= 0 ? <span className="text-muted">No savings, no share</span>
                        : <span className="text-muted">Share</span>}
                      <span className="font-data font-semibold text-ink" data-testid="sf-share">{on ? formatPesos(share) : formatPesos(0)}</span>
                    </span>
                  </span>
                </label>
              </li>;
            })}
          </ul>
        </fieldset>
        <div className="grid gap-1 rounded-md bg-canvas p-3 text-body-sm" role="status">
          <p>Overall savings (ticked): <strong className="font-data">{formatPesos(result.overall)}</strong></p>
          <p>Total shares: <strong className="font-data" data-testid="sf-total-shares">{formatPesos(result.total)}</strong></p>
          {result.remainder > 0 && ticked.size > 0 && result.total > 0 ? <p className="text-muted">{formatPesos(result.remainder)} stays in the fund.</p> : null}
          {availableCentavos <= 0 ? <p className="text-muted">There is no interest to distribute yet.</p> : null}
          {availableCentavos > 0 && ticked.size > 0 && result.overall <= 0 ? <p className="text-danger">No ticked participant has savings.</p> : null}
          {availableCentavos > 0 && result.overall > 0 && result.total === 0 ? <p className="text-danger">The fund is too small to share.</p> : null}
          {blocked.length > 0 ? <p className="text-danger" data-testid="sf-distribute-blocked">{blocked.map((participant) => participant.name).join(", ")} {blocked.length === 1 ? "still has an unpaid loan" : "still have unpaid loans"}. Pay {blocked.length === 1 ? "it" : "each loan"} or mark {blocked.length === 1 ? "it" : "them"} as a withdrawal first, or untick {blocked.length === 1 ? "this participant" : "them"}.</p> : null}
        </div>
        <Field label="Date" htmlFor="sf-dist-date" hint={date !== today ? "The exact amount is worked out for the date you pick." : undefined}>
          <Input id="sf-dist-date" type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="sf-dist-notes">
          <Textarea id="sf-dist-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="For example, 2026 year-end" />
        </Field>
        <p className="rounded-md bg-warn-soft p-3 text-body-sm text-warn" data-testid="sf-distribute-warning">{distributeWarning}</p>
        <ValidationSummary message={form.failure} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={!canConfirm}>{form.pending ? "Saving…" : `Distribute and close the year · ${formatPesos(result.total)}`}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
