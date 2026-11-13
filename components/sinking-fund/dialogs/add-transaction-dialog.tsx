"use client";

import { useMemo, useState, type FormEvent } from "react";
import { recordDeposit, recordLoan, recordPayment, recordSavingsWithdrawal } from "@/app/actions/sinking-fund";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select, Textarea, ValidationSummary } from "@/components/ui/form-field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AmountInput, Field, FieldError, SearchableSelect, readAmount, useSfSubmit } from "@/components/sinking-fund/form-kit";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate, pesoText } from "@/lib/sinking-fund/format";
import { formatLoanToast, formatPaymentToast, interestRangeMessage, loanTooHighMessage, paymentBeforeLoanMessage, paymentTooHighMessage, savingsWithdrawalTooHighMessage, sfMessages } from "@/lib/sinking-fund/messages";
import { allowedInterestRange, defaultInterestPart, isLoanStep, loanAmountDue, loanDueDate, loanInterest, SF_LOAN_STEP_CENTAVOS } from "@/lib/sinking-fund/rules";
import type { SfLoan, SfParticipantSummary, SfPrefill } from "@/lib/sinking-fund/types";

export type TransactionFormType = "deposit" | "loan" | "payment" | "savings_withdrawal";
export type TransactionDialogInitial = { participantId?: string; type?: TransactionFormType; loanId?: string };

const quickLoans = [50000, 100000, 200000, 500000];

/**
 * "Add transaction" (spec section 6): Deposit, Loan, Payment, and (owner only) Savings withdrawal, with live previews
 * and the same inline errors the database enforces. The server decides; this form only explains early.
 */
export function AddTransactionDialog({ participants, openLoans, prefill, isOwner, today, initial = {}, open, onOpenChange }: {
  participants: SfParticipantSummary[]; openLoans: SfLoan[]; prefill: SfPrefill; isOwner: boolean; today: string;
  initial?: TransactionDialogInitial; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const loansOf = (participantId: string | null) => openLoans.filter((loan) => loan.participant_id === participantId).sort((a, b) => a.loan_date.localeCompare(b.loan_date));
  const [participantId, setParticipantId] = useState<string | null>(initial.participantId ?? null);
  const [type, setType] = useState<TransactionFormType>(initial.type === "payment" && loansOf(initial.participantId ?? null).length === 0 ? "deposit" : initial.type ?? "deposit");
  const [loanId, setLoanId] = useState<string | null>(initial.loanId ?? loansOf(initial.participantId ?? null)[0]?.id ?? null);
  const [date, setDate] = useState(today);
  const [amountText, setAmountText] = useState("");
  const [interestText, setInterestText] = useState("");
  const [interestTouched, setInterestTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const form = useSfSubmit(() => onOpenChange(false));

  const participant = participants.find((item) => item.participant_id === participantId);
  const loans = useMemo(() => loansOf(participantId), [openLoans, participantId]); // eslint-disable-line react-hooks/exhaustive-deps
  const loan = loans.find((item) => item.id === loanId) ?? loans[0];
  const amount = readAmount(amountText);
  const centavos = amount.centavos ?? 0;
  const savings = participant?.savings_centavos ?? 0;
  const noLoans = loans.length === 0;

  // Payment math: the allowed interest part comes from the loan's other payments, so it is already in the loan's unpaid figures.
  const overBalance = type === "payment" && loan && centavos > loan.balance_centavos;
  const range = type === "payment" && loan && centavos > 0 && !overBalance ? allowedInterestRange(centavos, loan.unpaid_interest_centavos, loan.unpaid_principal_centavos) : null;
  const defaultPart = range ? defaultInterestPart(prefill, range) : 0;
  const typedInterest = readAmount(interestText);
  const interestPart = isOwner && interestTouched ? typedInterest.centavos ?? 0 : defaultPart;
  const interestShown = isOwner && interestTouched ? interestText : range ? pesoText(defaultPart) : "";
  const interestOutOfRange = Boolean(range && isOwner && interestTouched && (typedInterest.error || interestPart < range.min || interestPart > range.max));

  const loanTag = type === "loan" && centavos > 0 && isLoanStep(centavos)
    ? `5% interest (${formatPesos(loanInterest(centavos))}) · To pay: ${formatPesos(loanAmountDue(centavos))} · Due ${formatListDate(loanDueDate(date))}` : null;

  function changeParticipant(id: string | null) {
    setParticipantId(id);
    const mine = loansOf(id);
    setLoanId(mine[0]?.id ?? null);
    if (type === "payment" && mine.length === 0) setType("deposit");
    setInterestTouched(false);
    setErrors({});
  }

  function validate() {
    const found: Record<string, string> = {};
    if (!participantId) found.participant = "Choose a participant.";
    if (!date) found.date = "Choose a date.";
    else if (date > today) found.date = "The date cannot be in the future.";
    if (amount.error) found.amount = amount.error;
    else if (amount.centavos === null || amount.centavos <= 0) found.amount = "Enter an amount greater than ₱0.00.";
    else if (type === "loan") {
      if (!isLoanStep(centavos)) found.amount = sfMessages.loanStep;
      else if (date === today && centavos > savings) found.amount = loanTooHighMessage(savings);
    } else if (type === "savings_withdrawal") {
      if (date === today && centavos > savings) found.amount = savingsWithdrawalTooHighMessage(savings);
    } else if (type === "payment") {
      if (!loan) found.loan = "Choose a loan.";
      else if (overBalance) found.amount = paymentTooHighMessage(loan.balance_centavos);
      else if (date < loan.loan_date) found.date = paymentBeforeLoanMessage(formatListDate(loan.loan_date));
    }
    if (type === "payment" && range && interestOutOfRange) found.interest = interestRangeMessage(range.min, range.max);
    return found;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    const base = { date, amountCentavos: centavos, notes: notes || undefined, idempotencyKey: form.key };
    if (type === "deposit") await form.submit(() => recordDeposit({ ...base, participantId }), () => sfMessages.depositRecorded);
    else if (type === "loan") await form.submit(() => recordLoan({ ...base, participantId }), (data) => formatLoanToast(data.amountDueCentavos, data.dueDate));
    else if (type === "savings_withdrawal") await form.submit(() => recordSavingsWithdrawal({ ...base, participantId }), () => sfMessages.savingsWithdrawalRecorded);
    else await form.submit(() => recordPayment({ ...base, loanId: loan?.id, interestPartCentavos: isOwner ? interestPart : undefined }), (data) => formatPaymentToast(data.balanceAfterCentavos));
  }

  const errorFor = (name: string) => errors[name] ?? form.fieldErrors[name === "amount" ? "amount" : name];
  const amountError = errorFor("amount");
  const available = type === "loan" ? Math.max(savings, 0) : 0;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title="Add transaction" description="Record a deposit, a loan from the participant's own savings, or a payment.">
      <form noValidate className="grid gap-4" onSubmit={onSubmit}>
        <Field label="Participant" required htmlFor="sf-participant" error={errorFor("participant")}>
          <SearchableSelect id="sf-participant" label="Participant" options={participants.map((item) => ({ id: item.participant_id, label: item.name }))} value={participantId} onChange={changeParticipant} placeholder="Search participants" error={errorFor("participant")} />
        </Field>
        {participant ? <p className="text-body-sm text-muted" data-testid="sf-participant-figures">Total savings <strong className="text-ink">{formatPesos(participant.savings_centavos)}</strong> · Balance to pay <strong className="text-ink">{formatPesos(participant.balance_to_pay_centavos)}</strong></p> : null}

        <div className="grid gap-2">
          <span id="sf-type-label" className="text-sm font-medium text-ink">Type<span aria-hidden="true" className="ml-1 text-danger">*</span></span>
          <ToggleGroup aria-labelledby="sf-type-label" className="flex-wrap" value={[type]} onValueChange={(next) => { const picked = next.find((item) => item !== type) as TransactionFormType | undefined; if (picked) { setType(picked); setErrors({}); } }}>
            <ToggleGroupItem value="deposit">Deposit</ToggleGroupItem>
            <ToggleGroupItem value="loan">Loan</ToggleGroupItem>
            <ToggleGroupItem value="payment" disabled={Boolean(participantId) && noLoans}>Payment</ToggleGroupItem>
            {isOwner ? <ToggleGroupItem value="savings_withdrawal">Savings withdrawal</ToggleGroupItem> : null}
          </ToggleGroup>
          {participantId && noLoans ? <p className="text-body-sm text-muted">{sfMessages.noOpenLoans}</p> : null}
        </div>

        {type === "payment" && loans.length ? <Field label="Loan" required htmlFor="sf-loan" error={errorFor("loan")}>
          <Select id="sf-loan" value={loan?.id ?? ""} onChange={(event) => { setLoanId(event.target.value); setInterestTouched(false); }}>
            {loans.map((item) => <option key={item.id} value={item.id}>{formatListDate(item.loan_date)} · Due {formatPesos(item.amount_due_centavos)} · Balance {formatPesos(item.balance_centavos)}</option>)}
          </Select>
        </Field> : null}

        <Field label="Date" required htmlFor="sf-date" error={errorFor("date")}>
          <Input id="sf-date" type="date" value={date} max={today} min={type === "payment" && loan ? loan.loan_date : undefined} onChange={(event) => setDate(event.target.value)} aria-invalid={errorFor("date") ? true : undefined} />
        </Field>

        <Field label="Amount (₱)" required htmlFor="sf-amount" error={amountError}
          hint={type === "loan" ? `Available to borrow: ${formatPesos(available)}` : type === "payment" && loan ? <button type="button" className="font-semibold text-brand-dark underline" onClick={() => setAmountText(pesoText(loan.balance_centavos))}>Pay full balance</button> : null}>
          <AmountInput id="sf-amount" value={amountText} onChange={setAmountText} step={type === "loan" ? SF_LOAN_STEP_CENTAVOS : undefined} invalid={Boolean(amountError)} describedBy={amountError ? "sf-amount-error" : undefined} />
        </Field>

        {type === "loan" ? <div className="grid gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
            {quickLoans.filter((value) => value <= available).map((value) => <button key={value} type="button" className="touch-target rounded-md border border-control-border bg-surface px-3 text-body-sm font-semibold hover:bg-brand-soft" onClick={() => setAmountText(pesoText(value))}>{formatPesos(value).replace(".00", "")}</button>)}
          </div>
          {loanTag ? <p className="status-badge w-fit bg-warn-soft text-warn" data-testid="sf-loan-tag">{loanTag}</p> : null}
        </div> : null}

        {type === "payment" && loan && range ? <div className="grid gap-2">
          <Field label="Interest part (₱)" htmlFor="sf-interest" error={errorFor("interest")}
            hint={isOwner ? <>Allowed: {formatPesos(range.min)} to {formatPesos(range.max)} · Unpaid interest: {formatPesos(loan.unpaid_interest_centavos)}</> : <>Unpaid interest: {formatPesos(loan.unpaid_interest_centavos)}. {sfMessages.interestReadOnlyHint}</>}>
            <AmountInput id="sf-interest" value={interestShown} onChange={(value) => { setInterestTouched(true); setInterestText(value); }} invalid={Boolean(errorFor("interest"))} describedBy={errorFor("interest") ? "sf-interest-error" : undefined} />
          </Field>
          {isOwner ? <div className="flex flex-wrap gap-2">
            <button type="button" className="touch-target rounded-md border border-control-border bg-surface px-3 text-body-sm font-semibold hover:bg-brand-soft" onClick={() => { setInterestTouched(true); setInterestText(pesoText(range.min)); }}>None</button>
            <button type="button" className="touch-target rounded-md border border-control-border bg-surface px-3 text-body-sm font-semibold hover:bg-brand-soft" onClick={() => { setInterestTouched(true); setInterestText(pesoText(range.max)); }}>All unpaid interest</button>
          </div> : null}
        </div> : null}
        {type === "payment" && participantId && !loan ? <FieldError message={errorFor("loan")} /> : null}

        <Field label="Notes" htmlFor="sf-tx-notes">
          <Textarea id="sf-tx-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
        </Field>

        {participant && centavos > 0 ? <p className="rounded-md bg-canvas p-3 text-body-sm text-ink" role="status" data-testid="sf-preview">
          {type === "deposit" ? <>New total savings: <strong>{formatPesos(savings + centavos)}</strong></> : null}
          {type === "loan" ? <>New total savings: <strong>{formatPesos(savings - centavos)}</strong></> : null}
          {type === "savings_withdrawal" ? <>Savings after: <strong>{formatPesos(savings - centavos)}</strong></> : null}
          {type === "payment" && loan && !overBalance ? <>{formatPesos(interestPart)} to the Interest fund · {formatPesos(centavos - interestPart)} back to savings · {loan.balance_centavos - centavos === 0 ? <strong>Loan fully paid</strong> : <>Balance after: <strong>{formatPesos(loan.balance_centavos - centavos)}</strong></>}</> : null}
        </p> : null}

        <ValidationSummary message={form.failure} />
        <Button type="submit" disabled={form.pending}>{form.pending ? "Saving…" : "Save transaction"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
