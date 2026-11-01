"use client";

import { useState, useTransition } from "react";
import { setUnitStatus } from "@/app/actions/units";
import { setDriverStatus } from "@/app/actions/drivers";
import { upcomingAssignmentCount } from "@/app/actions/unit-assignments";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Select } from "@/components/ui/form-field";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { driverStatusOptions, unitStatusOptions, type DriverStatus, type StatusTone, type UnitStatus } from "@/lib/status/record-status";

// Same colours as StatusBadge (components/ui/feedback.tsx): green Active, yellow In repair, red Retired/Inactive.
const toneClass: Record<StatusTone, string> = {
  success: "bg-ok-soft! text-ok! border-ok/30!",
  warning: "bg-warn-soft! text-warn! border-warn/30!",
  danger: "bg-danger-soft! text-danger! border-danger/30!",
  muted: "bg-canvas! text-muted!",
};

// releaseName: the unit's or driver's name. When given, a change that would release daily
// assignments (a unit to In repair or Retired, a driver to Inactive) is confirmed first when any
// exist from today onward (feature 010, FR-030, FR-029b).
type Props =
  | { kind: "unit"; id: string; value: UnitStatus; label: string; disabled?: boolean; align?: "start" | "end"; releaseName?: string }
  | { kind: "driver"; id: string; value: DriverStatus; label: string; disabled?: boolean; align?: "start" | "end"; releaseName?: string };

// Badge-like size, 1.5x the status badge: 2.125rem tall (the badge is 1.4rem), sized to its text.
// A native select ignores line-height, so the height is set directly.
const sizeClass = "w-auto min-h-0! h-8.5! rounded-md! py-0! pl-3! pr-8! text-body-sm! font-bold";

/**
 * Status dropdown for the units and drivers lists and detail pages (feature 005). Shows the new
 * status at once, saves it, and goes back to the saved status with the reason if it is refused.
 */
export function StatusSelect({ kind, id, value, label, disabled, align = "end", releaseName }: Props) {
  const [shown, setShown] = useState<string>(value);
  const [confirming, setConfirming] = useState<{ next: string; previous: string } | null>(null);
  const [saved, setSaved] = useState<string>(value);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  // The page passes a new value after it refreshes; show that instead of any local state.
  if (saved !== value) { setSaved(value); setShown(value); }
  const options = kind === "unit" ? unitStatusOptions : driverStatusOptions;
  const tone = options.find((option) => option.value === shown)?.tone ?? "muted";

  const releases = (next: string) => kind === "unit" ? next === "in_repair" || next === "retired" : next === "inactive";

  function change(next: string) {
    if (next === shown) return;
    const previous = shown;
    setShown(next);
    setError("");
    if (!releaseName || !releases(next)) { save(next, previous); return; }
    startTransition(async () => {
      try {
        const result = await upcomingAssignmentCount(kind === "unit" ? { unitId: id } : { driverId: id });
        if (!result.ok) { setShown(previous); setError(result.message); return; }
        if (result.data.count > 0) setConfirming({ next, previous }); else save(next, previous);
      } catch (reason) {
        setShown(previous);
        setError(clientErrorMessage(reason));
      }
    });
  }

  function save(next: string, previous: string) {
    startTransition(async () => {
      try {
        const result = kind === "unit"
          ? await setUnitStatus({ id, status: next, expectedStatus: previous })
          : await setDriverStatus({ id, status: next, expectedStatus: previous });
        if (!result.ok) { setShown(previous); setError(result.message); }
      } catch (reason) {
        setShown(previous);
        setError(clientErrorMessage(reason));
      }
    });
  }

  const confirmTitle = kind === "unit"
    ? `${releaseName} has driver assignments from today onward. Changing the status will release them. Continue?`
    : `${releaseName} is assigned from today onward. Deactivating will release those units. Continue?`;

  // The refusal message floats under the control, so it never changes the size of the row or cell.
  return <div className="relative inline-block">
    <AlertDialog open={confirming !== null} onOpenChange={(open) => { if (!open && confirming) { setShown(confirming.previous); setConfirming(null); } }}>
      <AlertDialogContent title={confirmTitle}>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" />}>Cancel</AlertDialogClose>
          <Button type="button" onClick={() => { const pendingChange = confirming; setConfirming(null); if (pendingChange) save(pendingChange.next, pendingChange.previous); }}>Continue</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Select aria-label={label} value={shown} disabled={disabled || pending} onChange={(event) => change(event.target.value)} className={`${sizeClass} ${toneClass[tone]}`}>
      {options.map((option) => <option key={option.value} value={option.value} className="bg-surface font-normal text-ink">{option.label}</option>)}
    </Select>
    {error ? <p role="alert" className={`absolute top-full z-10 mt-1 w-56 rounded-md border border-danger/30 bg-surface p-2 text-body-sm text-danger shadow-md ${align === "end" ? "right-0" : "left-0"}`}>
      {error} <button type="button" className="font-semibold underline" onClick={() => setError("")}>Dismiss</button>
    </p> : null}
  </div>;
}
