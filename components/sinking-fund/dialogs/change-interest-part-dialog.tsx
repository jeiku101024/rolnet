"use client";

import { useEffect, useState, type FormEvent } from "react";
import { changeInterestPart, getAllowedInterest } from "@/app/actions/sinking-fund";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ValidationSummary } from "@/components/ui/form-field";
import { AmountInput, Field, readAmount, useSfSubmit } from "@/components/sinking-fund/form-kit";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate, pesoText } from "@/lib/sinking-fund/format";
import { interestRangeMessage, sfMessages } from "@/lib/sinking-fund/messages";
import type { SfLedgerRow } from "@/lib/sinking-fund/types";

const signed = (centavos: number) => `${centavos >= 0 ? "+" : "-"}${formatPesos(Math.abs(centavos))}`;

/** "Change interest part" (spec section 7), owner only: the allowed range comes from the loan's other payments. */
export function ChangeInterestPartDialog({ payment, open, onOpenChange }: { payment: SfLedgerRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const current = payment.interest_part_centavos ?? 0;
  const [range, setRange] = useState<{ min: number; max: number } | null>(null);
  const [text, setText] = useState(pesoText(current));
  const [error, setError] = useState<string | undefined>();
  const form = useSfSubmit(() => onOpenChange(false));

  useEffect(() => {
    let cancelled = false;
    getAllowedInterest(payment.loan_id!, payment.amount_centavos, payment.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setRange(result.data); else form.setFailure(result.message);
    });
    return () => { cancelled = true; };
    // The range is read once when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsed = readAmount(text);
  const next = parsed.centavos ?? current;
  const delta = next - current;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (parsed.error || parsed.centavos === null) { setError(parsed.error ?? "Enter ₱0.00 or more."); return; }
    if (range && (parsed.centavos < range.min || parsed.centavos > range.max)) { setError(interestRangeMessage(range.min, range.max)); return; }
    setError(undefined);
    await form.submit(() => changeInterestPart({ paymentId: payment.id, interestPartCentavos: parsed.centavos, expectedUpdatedAt: payment.updated_at }), () => sfMessages.interestPartUpdated);
  }

  const shownError = error ?? form.fieldErrors.interest;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title="Change interest part" description="Moves part of this payment between the Interest fund and the participant's savings.">
      <form noValidate className="grid gap-4" onSubmit={onSubmit}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm">
          <dt className="text-muted">Participant</dt><dd>{payment.participant_name}</dd>
          <dt className="text-muted">Payment</dt><dd>{formatListDate(payment.tx_date)} · {formatPesos(payment.amount_centavos)}</dd>
          <dt className="text-muted">Now</dt><dd>{formatPesos(current)} interest · {formatPesos(payment.principal_part_centavos ?? 0)} to savings</dd>
          {payment.loan_date ? <><dt className="text-muted">Loan</dt><dd>{formatListDate(payment.loan_date)}</dd></> : null}
        </dl>
        <Field label="Interest part (₱)" htmlFor="sf-new-interest" error={shownError} hint={range ? `Allowed: ${formatPesos(range.min)} to ${formatPesos(range.max)}` : "Checking the allowed range…"}>
          <AmountInput id="sf-new-interest" value={text} onChange={setText} invalid={Boolean(shownError)} describedBy={shownError ? "sf-new-interest-error" : undefined} />
        </Field>
        <p className="rounded-md bg-canvas p-3 text-body-sm" role="status">Interest fund <strong>{signed(delta)}</strong> · Total savings <strong>{signed(-delta)}</strong></p>
        <ValidationSummary message={form.failure} />
        <Button type="submit" disabled={form.pending || !range}>{form.pending ? "Saving…" : "Save interest part"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
