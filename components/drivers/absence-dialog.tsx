"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { previewAbsence, saveAbsence, type AbsencePreview, type ReleaseRow } from "@/app/actions/driver-absences";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Feedback } from "@/components/ui/feedback";
import { FormField, Input, Select, Textarea, ValidationSummary } from "@/components/ui/form-field";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { ReleaseConfirm } from "@/components/drivers/release-confirm-dialog";
import { reasonOptions, type Absence } from "@/lib/drivers/absences";
import type { DriverAbsenceReason, DriverAbsenceType } from "@/types/database";

type Field = "type" | "startDate" | "endDate" | "reason";

const typeOptions: { value: DriverAbsenceType; label: string }[] = [
  { value: "day_off", label: "Day-off, one date" },
  { value: "on_leave", label: "On-leave, date range" },
];

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-xs font-normal text-danger">{message}</span> : null;
}

function pastWarning(past: AbsencePreview["past"]) {
  const parts = [
    past.assignments ? `${past.assignments} ${past.assignments === 1 ? "assignment" : "assignments"}` : "",
    past.remittances ? `${past.remittances} ${past.remittances === 1 ? "remittance" : "remittances"}` : "",
  ].filter(Boolean);
  return `Past dates selected. ${parts.join(" and ")} already exist in this range. They will not be changed.`;
}

/**
 * "Add absence · [driver]" / "Edit absence" (feature 012, contracts/ui.md). Checks the dates first
 * (overlap, past records, assignments to release), then saves. When saved assignments would be
 * released, a second view lists them for confirmation (FR-042).
 */
export function AbsenceDialog({ open, onOpenChange, driver, initialType = "day_off", absence, focusEnd = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: { id: string; name: string };
  initialType?: DriverAbsenceType;
  /** Edit mode: the absence being edited. With `focusEnd` ("Set end date"), the leave opens with open-ended unticked and To empty. */
  absence?: Absence;
  focusEnd?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const endId = useId();
  const [type, setType] = useState<DriverAbsenceType>(absence?.absence_type ?? initialType);
  const [startDate, setStartDate] = useState(absence?.start_date ?? "");
  const [endDate, setEndDate] = useState(focusEnd ? "" : absence?.end_date ?? "");
  const [openEnded, setOpenEnded] = useState(focusEnd ? false : absence ? absence.absence_type === "on_leave" && absence.end_date === null : false);
  const [reason, setReason] = useState<DriverAbsenceReason | "">(absence?.reason ?? "");
  const [note, setNote] = useState(absence?.note ?? "");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | undefined>();
  const [pastAcknowledged, setPastAcknowledged] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [release, setRelease] = useState<ReleaseRow[] | null>(null);
  const [pending, setPending] = useState(false);

  // "Set end date" puts the cursor in To.
  useEffect(() => {
    if (open && focusEnd) { const timer = setTimeout(() => document.getElementById(endId)?.focus(), 50); return () => clearTimeout(timer); }
  }, [open, focusEnd, endId]);

  const isLeave = type === "on_leave";
  const input = () => ({
    id: absence?.id, driverId: driver.id, type, startDate, endDate: isLeave && !openEnded ? endDate || null : null, openEnded: isLeave && openEnded,
    reason: reason || undefined, note: note.trim() || undefined, expectedUpdatedAt: absence?.updated_at,
  });
  // The past-date warning applies to the dates it was shown for; changing them asks again.
  const datesKey = `${type}|${startDate}|${endDate}|${openEnded}`;

  function validate() {
    const next: Partial<Record<Field, string>> = {};
    if (!startDate) next.startDate = isLeave ? "Choose the From date." : "Choose the date.";
    if (isLeave && !openEnded) {
      if (!endDate) next.endDate = "Choose the To date, or tick No end date yet.";
      else if (startDate && endDate < startDate) next.endDate = "The To date must be on or after the From date.";
    }
    if (!reason) next.reason = "Choose a reason.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(releaseIds: string[]) {
    const result = await saveAbsence({ ...input(), releaseIds });
    if (result.ok) {
      onOpenChange(false);
      toast(result.data.toast);
      router.refresh();
      return;
    }
    // Assignments changed since the check: show the new list.
    if (result.code === "STALE_RECORD" && /Assignments for these dates changed/.test(result.message)) {
      const again = await previewAbsence(input());
      if (again.ok && again.data.release.length) { setRelease(again.data.release); return; }
    }
    setRelease(null);
    setFailure(result.message);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !validate()) return;
    setFailure(undefined);
    setPending(true);
    try {
      const preview = await previewAbsence(input());
      if (!preview.ok) { setFailure(preview.message); return; }
      const { conflict, past, release: toRelease } = preview.data;
      if (conflict) { setErrors({ [isLeave ? "endDate" : "startDate"]: conflict }); return; }
      if ((past.assignments || past.remittances) && pastAcknowledged !== datesKey) {
        setWarning(pastWarning(past));
        setPastAcknowledged(datesKey);
        return;
      }
      if (toRelease.length) { setRelease(toRelease); return; }
      await save([]);
    } catch (reason) {
      setFailure(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  async function confirmRelease() {
    if (!release || pending) return;
    setPending(true);
    try { await save(release.map((row) => row.id)); } catch (reason) { setFailure(clientErrorMessage(reason)); setRelease(null); } finally { setPending(false); }
  }

  const showWarning = warning && pastAcknowledged === datesKey;
  const title = release ? "Release assignments?" : absence ? "Edit absence" : `Add absence · ${driver.name}`;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title={title}>
      {release ? <ReleaseConfirm rows={release} pending={pending} onBack={() => setRelease(null)} onConfirm={confirmRelease} /> : <form noValidate className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-2 text-sm font-medium text-ink">
          <span id="absence-type-label">Type<span aria-hidden="true" className="ml-1 text-danger">*</span></span>
          <SegmentedToggle label="Absence type" value={type} options={typeOptions} onChange={(next) => { setType(next); setErrors({}); }} />
        </div>
        {isLeave ? <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="From" required><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-invalid={Boolean(errors.startDate) || undefined} /><FieldError message={errors.startDate} /></FormField>
            <FormField label="To" required={!openEnded}><Input id={endId} type="date" value={openEnded ? "" : endDate} min={startDate || undefined} disabled={openEnded} onChange={(event) => setEndDate(event.target.value)} aria-invalid={Boolean(errors.endDate) || undefined} /><FieldError message={errors.endDate} /></FormField>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
            <Checkbox checked={openEnded} onCheckedChange={(checked) => { setOpenEnded(checked); if (checked) { setEndDate(""); setErrors((current) => ({ ...current, endDate: undefined })); } }} />
            No end date yet (open-ended)
          </label>
        </> : <FormField label="Date" required><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-invalid={Boolean(errors.startDate) || undefined} /><FieldError message={errors.startDate} /></FormField>}
        <FormField label="Reason" required>
          <Select value={reason} onChange={(event) => setReason(event.target.value as DriverAbsenceReason)} aria-invalid={Boolean(errors.reason) || undefined}>
            <option value="" disabled>Choose a reason</option>
            {reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <FieldError message={errors.reason} />
        </FormField>
        <FormField label="Note (optional)"><Textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></FormField>
        {showWarning ? <Feedback type="warning" message={warning} /> : null}
        <ValidationSummary message={failure} />
        <Button type="submit" disabled={pending}>{pending ? "Checking…" : showWarning ? "Save anyway" : "Save absence"}</Button>
      </form>}
    </DialogContent>
  </Dialog>;
}
