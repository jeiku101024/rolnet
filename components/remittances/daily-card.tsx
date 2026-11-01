"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lock, MoreHorizontal, UserPlus, Wrench } from "lucide-react";
import { editDailyRemittance, saveDailyRemittance } from "@/app/actions/remittances";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLinkItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BalanceBadge } from "@/components/remittances/balance-badge";
import { MoneyText } from "@/components/remittances/money-text";
import { DriverTag } from "@/components/remittances/driver-tag";
import { StatusBadge } from "@/components/ui/feedback";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { formatPesos, parseCentavos } from "@/lib/money/centavos";
import { formatShortDate } from "@/lib/dates/fleet-date";
import { remittanceTotals } from "@/lib/remittances/totals";
import { ALLOWANCE_CENTAVOS, depositFor, exceedsRental, overRentalMessage } from "@/lib/remittances/financials";
import { dueFor, type DailyCard as Card, type Disposition, type SavedCard } from "@/lib/remittances/daily-board";
import { unitStatusLabel } from "@/lib/status/record-status";
import { unitsDailyHref } from "@/lib/units/view-params";

export type CardView = Card & { notice?: string };

const pastEditFlag = "rolnet:past-edit-confirmed";
const amountHint = "Enter an amount like 180 or 180.50.";
const shell = "grid min-w-0 content-start gap-3 rounded-md border border-rule p-4";
const pickerButton = "touch-target inline-flex items-center gap-2 rounded-md border border-control-border bg-surface px-3 text-body-sm font-semibold text-ink hover:bg-brand-soft";

function centavosText(centavos: number) {
  return centavos ? (centavos / 100).toFixed(2) : "";
}

function parseAmount(text: string) {
  if (!text.trim()) return 0;
  try { return parseCentavos(text); } catch { return null; }
}

function UnitName({ name }: { name: string }) {
  return <Tooltip>
    <TooltipTrigger render={<h3 className="min-w-0 truncate text-section-title font-bold text-ink" />}>{name}</TooltipTrigger>
    <TooltipContent>{name}</TooltipContent>
  </Tooltip>;
}

/** One unit's card in Daily view (feature 008, contracts/remittances-page.md; feature 010 cards). */
export function DailyCard({ card, date, isToday, isOwner, onSaved, onDirty, onReload }: {
  card: CardView; date: string; isToday: boolean; isOwner: boolean;
  onSaved: (card: SavedCard & { notice?: string }) => void; onDirty: (key: string, dirty: boolean) => void; onReload: (key: string) => void;
}) {
  if (card.kind === "blocked") {
    const label = unitStatusLabel(card.status);
    return <article className={`${shell} bg-muted`} aria-label={`${card.unitName}, ${label}`}>
      <UnitName name={card.unitName} />
      <StatusBadge label={label} tone={card.status === "retired" ? "danger" : "warning"} />
      <p className="flex gap-2 text-body-sm text-muted"><Wrench aria-hidden="true" size={16} className="mt-0.5 shrink-0" />Unit is {label.toLowerCase()}. No remittance for this date.</p>
    </article>;
  }
  if (card.kind === "no-driver") {
    return <article className={`${shell} bg-surface`} aria-label={`${card.unitName}, no driver`}>
      <UnitName name={card.unitName} />
      <p className="text-body-sm text-muted">No driver assigned for this date.</p>
      <Link className={`${pickerButton} w-fit`} href={unitsDailyHref(date)}><UserPlus aria-hidden="true" size={16} />Assign driver</Link>
    </article>;
  }
  return <RecordCard card={card} date={date} isToday={isToday} isOwner={isOwner} onSaved={onSaved} onDirty={onDirty} onReload={onReload} />;
}

function RecordCard({ card, date, isToday, isOwner, onSaved, onDirty, onReload }: {
  card: Extract<CardView, { kind: "saved" | "unrecorded" }>; date: string; isToday: boolean; isOwner: boolean;
  onSaved: (card: SavedCard & { notice?: string }) => void; onDirty: (key: string, dirty: boolean) => void; onReload: (key: string) => void;
}) {
  const saved = card.kind === "saved" ? card : null;
  const [editing, setEditing] = useState(!saved);
  const [disposition, setDisposition] = useState<Disposition>(saved?.disposition ?? "returned");
  const [payment, setPayment] = useState(saved ? centavosText(saved.receivedCentavos) : "");
  const [notes, setNotes] = useState(saved?.notes ?? "");
  const [error, setError] = useState<{ message: string; reload?: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmPast, setConfirmPast] = useState(false);
  const [lowering, setLowering] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const busy = useRef(false);
  const keys = useRef<{ remittance?: string; payment?: string }>({});
  const key = (name: "remittance" | "payment") => (keys.current[name] ??= crypto.randomUUID());

  const due = saved ? saved.dueCentavos : dueFor(disposition);
  const typed = parseAmount(payment);
  // A legacy overpaid record (before feature 009) may keep its saved amount, but not take more.
  const overRental = typed !== null && exceedsRental(typed, due) && !(saved && typed === saved.receivedCentavos);
  const dirty = saved ? editing && (payment !== centavosText(saved.receivedCentavos) || notes !== saved.notes) : disposition !== "returned" || payment !== "" || notes !== "";
  const { key: cardKey } = card;
  useEffect(() => { onDirty(cardKey, dirty); }, [cardKey, dirty, onDirty]);
  useEffect(() => () => onDirty(cardKey, false), [cardKey, onDirty]);

  function startEdit() {
    if (!isToday && sessionStorage.getItem(pastEditFlag) !== "1") { setConfirmPast(true); return; }
    setEditing(true);
  }

  function cancelEdit() {
    if (!saved) return;
    setPayment(centavosText(saved.receivedCentavos));
    setNotes(saved.notes);
    setError(null);
    setEditing(false);
  }

  async function submit(lowerReason?: string) {
    if (busy.current) return;
    const amount = parseAmount(payment);
    if (amount === null) { setError({ message: amountHint }); return; }
    if (overRental) return;
    if (saved && amount < saved.receivedCentavos && !lowerReason) {
      if (!isOwner) { setError({ message: "Only the owner can lower a recorded payment." }); return; }
      setLowering(amount);
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      if (card.kind === "unrecorded") {
        const result = await saveDailyRemittance({ unitId: card.unitId, driverId: card.driver.driverId, serviceDate: date, disposition, notes: notes.trim() || undefined, paymentCentavos: amount, remittanceKey: key("remittance"), paymentKey: key("payment") });
        if (!result.ok) { setError({ message: result.message, reload: result.code === "DUPLICATE_REMITTANCE" || result.code === "DUPLICATE_RECORD" }); return; }
        keys.current = {};
        onSaved({ ...card, kind: "saved", remittanceId: result.data.id, updatedAt: result.data.updatedAt, disposition, dueCentavos: dueFor(disposition), receivedCentavos: result.data.receivedCentavos, allowanceCentavos: ALLOWANCE_CENTAVOS, depositCentavos: result.data.depositCentavos, notes: notes.trim(), notice: result.data.partial ?? undefined });
      } else if (saved) {
        const result = await editDailyRemittance({ remittanceId: saved.remittanceId, expectedUpdatedAt: saved.updatedAt, notes: notes.trim(), targetPaymentCentavos: amount, reason: lowerReason, paymentKey: key("payment") });
        if (!result.ok) { setError({ message: result.message, reload: result.code === "STALE_RECORD" || result.code === "PARTIAL" }); return; }
        keys.current = {};
        onSaved({ ...saved, updatedAt: result.data.updatedAt, receivedCentavos: result.data.receivedCentavos, depositCentavos: result.data.depositCentavos, notes: notes.trim() });
      }
    } catch (reasonThrown) {
      setError({ message: clientErrorMessage(reasonThrown) });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const locked = Boolean(saved) && !editing;
  const totals = saved ? remittanceTotals(saved.dueCentavos, [{ amount_centavos: saved.receivedCentavos }]) : null;
  const allowance = saved ? saved.allowanceCentavos : ALLOWANCE_CENTAVOS;
  const deposit = locked && saved ? saved.depositCentavos : typed === null || overRental ? null : depositFor(typed, allowance);

  return <article className={`${shell} ${locked ? "bg-muted" : "bg-surface"}`} aria-label={card.unitName}>
    <div className="flex min-w-0 items-start justify-between gap-2">
      <div className="grid min-w-0 gap-1">
        <UnitName name={card.unitName} />
        <DriverTag driver={card.driver} />
      </div>
      {saved ? <DropdownMenu>
        <DropdownMenuTrigger className="touch-target -mt-2 -mr-2 inline-flex w-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-brand-soft" aria-label="Card options"><MoreHorizontal aria-hidden="true" size={18} /></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled={editing} onClick={startEdit}>Edit remittance</DropdownMenuItem>
          {isOwner ? <DropdownMenuLinkItem render={<Link href={`/remittances/${saved.remittanceId}`} />}>View record details</DropdownMenuLinkItem> : null}
        </DropdownMenuContent>
      </DropdownMenu> : null}
    </div>

    <p className="flex items-baseline justify-between gap-2"><span className="text-body-sm text-muted">Rental</span><span className="font-data text-page-title font-bold text-ink" aria-live="polite">{formatPesos(due)}</span></p>

    <FormField label="Disposition" hint={saved && editing ? `Disposition can't be changed after saving.${isOwner ? " Reverse it on the record's details page to change it." : ""}` : undefined}>
      <Select value={disposition} disabled={Boolean(saved)} onChange={(event) => setDisposition(event.target.value as Disposition)}>
        <option value="returned">Returned</option>
        <option value="overnight_overtime">Overnight / overtime</option>
      </Select>
    </FormField>
    <FormField label="Payment received (₱)">
      <Input inputMode="decimal" placeholder="0.00" value={payment} disabled={locked || pending} onChange={(event) => setPayment(event.target.value)} aria-invalid={error?.message === amountHint || (overRental && !locked) || undefined} />
    </FormField>
    <FormField label="Notes">
      <Input placeholder="Add a note" maxLength={1000} value={notes} disabled={locked || pending} onChange={(event) => setNotes(event.target.value)} />
    </FormField>

    <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-body-sm text-muted" aria-live="polite">
      <dt>Allowance</dt><dd className="text-right font-data"><MoneyText centavos={allowance} /></dd>
      <dt>Deposit</dt><dd className="text-right font-data">{deposit === null ? "—" : <MoneyText centavos={deposit} />}</dd>
    </dl>

    {overRental && !locked ? <p role="alert" className="text-body-sm text-danger">{overRentalMessage(due)}</p> : null}
    {error ? <div role="alert" className="grid gap-2 text-body-sm text-danger"><p>{error.message}</p>{error.reload ? <Button type="button" variant="outline" className="w-fit" onClick={() => { setError(null); onReload(card.key); }}>Reload</Button> : null}</div> : null}
    {card.notice && locked ? <p role="status" className="text-body-sm text-warn">{card.notice}</p> : null}

    {locked && totals ? <div className="flex flex-wrap items-center justify-between gap-2">
      <BalanceBadge balance={totals.balance} />
      <span className="inline-flex items-center gap-1 text-body-sm font-semibold text-muted"><Lock aria-hidden="true" size={14} />Saved</span>
    </div> : <div className="flex flex-wrap gap-2">
      <Button type="button" className="flex-1" disabled={pending} onClick={() => submit()}>{pending ? "Saving…" : "Save remittance"}</Button>
      {saved ? <Button type="button" variant="outline" disabled={pending} onClick={cancelEdit}>Cancel</Button> : null}
    </div>}

    <AlertDialog open={confirmPast} onOpenChange={setConfirmPast}>
      <AlertDialogContent title={`You're editing a record from ${formatShortDate(date)}. Continue?`}>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" />}>Cancel</AlertDialogClose>
          <Button type="button" onClick={() => { sessionStorage.setItem(pastEditFlag, "1"); setConfirmPast(false); setEditing(true); }}>Continue</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={lowering !== null} onOpenChange={(open) => { if (!open) setLowering(null); }}>
      <AlertDialogContent title={saved && lowering !== null ? `Lower the payment from ${formatPesos(saved.receivedCentavos)} to ${formatPesos(lowering)}?` : "Lower the payment?"} description="The earlier payments are voided with your reason, and the new amount is recorded.">
        <FormField label="Reason" required hint="At least 3 characters.">
          <Input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        </FormField>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" />}>Cancel</AlertDialogClose>
          <Button type="button" disabled={reason.trim().length < 3} onClick={() => { const text = reason.trim(); setLowering(null); setReason(""); void submit(text); }}>Lower payment</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </article>;
}
