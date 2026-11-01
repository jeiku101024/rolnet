"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, MoreHorizontal, Wrench } from "lucide-react";
import { saveUnitAssignment } from "@/app/actions/unit-assignments";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/ui/feedback";
import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { formatShortDate } from "@/lib/dates/fleet-date";
import { unitStatusLabel } from "@/lib/status/record-status";
import { RecordMileageDialog } from "@/components/units/record-mileage-dialog";
import type { AssignmentCard as Card } from "@/lib/units/assignment-board";

const pastEditFlag = "rolnet.pastAssignmentEditOk";
const shell = "grid min-w-0 content-start gap-3 rounded-md border border-rule p-4";

function Truncated({ text, className }: { text: string; className: string }) {
  return <Tooltip>
    <TooltipTrigger render={<p className={`min-w-0 truncate ${className}`} />}>{text}</TooltipTrigger>
    <TooltipContent>{text}</TooltipContent>
  </Tooltip>;
}

/** One unit's card in the Daily assignment view (feature 010, contracts/ui.md "Card"). */
export function AssignmentCard({ card, date, today, isOwner }: { card: Card; date: string; today: string; isOwner: boolean }) {
  const header = <div className="grid min-w-0 gap-1">
    <Truncated text={card.unitName} className="text-section-title font-bold text-ink" />
    <Truncated text={card.subheader} className="text-body-sm text-muted" />
  </div>;

  if (card.kind === "blocked") {
    const label = unitStatusLabel(card.status);
    return <article className={`${shell} bg-muted`} aria-label={`${card.unitName}, ${label}`}>
      {header}
      <StatusBadge label={label} tone={card.status === "retired" ? "danger" : "warning"} />
      <FormField label="Assign driver"><Select disabled value=""><option value="">No driver</option></Select></FormField>
      <FormField label="Notes"><Input disabled placeholder="Add a note" /></FormField>
      <Button type="button" disabled>Save assignment</Button>
      <p className="flex gap-2 text-body-sm text-muted"><Wrench aria-hidden="true" size={16} className="mt-0.5 shrink-0" />Unit is {label.toLowerCase()}. Change its status on the unit page to assign a driver.</p>
      {isOwner ? <Link className="muted-link w-fit text-body-sm font-semibold" href={`/units/${card.unitId}`}>Open unit</Link> : null}
      <RecordMileageDialog unitId={card.unitId} unitLabel={card.unitName} currentMileage={card.currentMileage} />
    </article>;
  }
  return <EditableCard card={card} date={date} today={today} />;
}

function EditableCard({ card, date, today }: { card: Exclude<Card, { kind: "blocked" }>; date: string; today: string }) {
  const router = useRouter();
  const saved = card.kind === "open" ? null : card;
  const initialDriver = saved ? saved.driverId : card.kind === "open" ? card.prefillDriverId ?? "" : "";
  const [editing, setEditing] = useState(!saved);
  const [driverId, setDriverId] = useState(initialDriver);
  const [notes, setNotes] = useState(saved?.notes ?? "");
  const [error, setError] = useState<{ message: string; reload?: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmPast, setConfirmPast] = useState(false);
  const prefilled = card.kind === "open" && card.prefillDriverId !== null && driverId === card.prefillDriverId;
  const locked = Boolean(saved) && !editing;
  const noOptions = card.options.length === 0;

  function startEdit() {
    if (date < today && sessionStorage.getItem(pastEditFlag) !== "1") { setConfirmPast(true); return; }
    setEditing(true);
  }

  function cancelEdit() {
    if (!saved) return;
    setDriverId(saved.driverId);
    setNotes(saved.notes);
    setError(null);
    setEditing(false);
  }

  async function submit() {
    if (pending) return;
    if (!driverId) { setError({ message: "Choose a driver first" }); return; }
    setPending(true);
    setError(null);
    try {
      const result = await saveUnitAssignment({ unitId: card.unitId, serviceDate: date, driverId, notes, expectedUpdatedAt: saved?.updatedAt });
      if (!result.ok) {
        if (result.code === "DRIVER_TAKEN") setDriverId("");
        setError({ message: result.message, reload: result.code === "STALE_RECORD" || result.code === "UNIT_TAKEN" });
        router.refresh();
        return;
      }
      setEditing(false);
      router.refresh();
    } catch (reason) {
      setError({ message: clientErrorMessage(reason) });
    } finally {
      setPending(false);
    }
  }

  return <article className={`${shell} ${locked ? "bg-muted" : "bg-surface"}`} aria-label={card.unitName}>
    <div className="flex min-w-0 items-start justify-between gap-2">
      <div className="grid min-w-0 gap-1">
        <Truncated text={card.unitName} className="text-section-title font-bold text-ink" />
        <Truncated text={card.subheader} className="text-body-sm text-muted" />
      </div>
      {card.kind === "saved" ? <DropdownMenu>
        <DropdownMenuTrigger className="touch-target -mt-2 -mr-2 inline-flex w-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-brand-soft" aria-label="Card options"><MoreHorizontal aria-hidden="true" size={18} /></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled={editing} onClick={startEdit}>Edit assignment</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu> : null}
    </div>

    <FormField label="Assign driver" hint={prefilled && !locked ? "Pre-filled from previous day" : undefined}>
      <Select value={driverId} disabled={locked || pending || (noOptions && !saved)} onChange={(event) => { setDriverId(event.target.value); setError(null); }} aria-invalid={error?.message === "Choose a driver first" || undefined}>
        {noOptions && !saved ? <option value="">No available drivers</option> : <option value="">Choose a driver</option>}
        {saved && !card.options.some((option) => option.id === saved.driverId) ? <option value={saved.driverId}>{saved.driverLabel}</option> : null}
        {card.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </Select>
    </FormField>
    <FormField label="Notes">
      <Input placeholder="Add a note" maxLength={500} value={notes} disabled={locked || pending} onChange={(event) => setNotes(event.target.value)} />
    </FormField>

    {error ? <div role="alert" className="grid gap-2 text-body-sm text-danger"><p>{error.message}</p>{error.reload ? <Button type="button" variant="outline" className="w-fit" onClick={() => { setError(null); router.refresh(); }}>Reload</Button> : null}</div> : null}

    {locked ? <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge label="Assigned" tone="success" />
        <span className="inline-flex items-center gap-1 text-body-sm font-semibold text-muted"><Lock aria-hidden="true" size={14} />Saved</span>
      </div>
      {card.kind === "locked" ? <p className="text-body-sm text-muted">A remittance is already recorded for this day.</p> : null}
    </div> : <div className="flex flex-wrap gap-2">
      <Button type="button" className="flex-1" disabled={pending || (noOptions && !saved)} onClick={submit}>{pending ? "Saving…" : "Save assignment"}</Button>
      {saved ? <Button type="button" variant="outline" disabled={pending} onClick={cancelEdit}>Cancel</Button> : null}
    </div>}

    <RecordMileageDialog unitId={card.unitId} unitLabel={card.unitName} currentMileage={card.currentMileage} />

    <AlertDialog open={confirmPast} onOpenChange={setConfirmPast}>
      <AlertDialogContent title={`You are editing an assignment from ${formatShortDate(date)}. Continue?`}>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" />}>Cancel</AlertDialogClose>
          <Button type="button" onClick={() => { sessionStorage.setItem(pastEditFlag, "1"); setConfirmPast(false); setEditing(true); }}>Continue</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </article>;
}
