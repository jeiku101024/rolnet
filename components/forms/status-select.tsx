"use client";

import { useState, useTransition } from "react";
import { setUnitStatus } from "@/app/actions/units";
import { setDriverStatus } from "@/app/actions/drivers";
import { Select } from "@/components/ui/form-field";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { driverStatusOptions, unitStatusOptions, type DriverStatus, type UnitStatus } from "@/lib/status/record-status";

type Props =
  | { kind: "unit"; id: string; value: UnitStatus; label: string; disabled?: boolean }
  | { kind: "driver"; id: string; value: DriverStatus; label: string; disabled?: boolean };

/**
 * Status dropdown for the units and drivers lists and detail pages (feature 005). Shows the new
 * status at once, saves it, and goes back to the saved status with the reason if it is refused.
 */
export function StatusSelect({ kind, id, value, label, disabled }: Props) {
  const [shown, setShown] = useState<string>(value);
  const [saved, setSaved] = useState<string>(value);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  // The page passes a new value after it refreshes; show that instead of any local state.
  if (saved !== value) { setSaved(value); setShown(value); }
  const options = kind === "unit" ? unitStatusOptions : driverStatusOptions;

  function change(next: string) {
    if (next === shown) return;
    const previous = shown;
    setShown(next);
    setError("");
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

  return <div className="min-w-0">
    <Select aria-label={label} value={shown} disabled={disabled || pending} onChange={(event) => change(event.target.value)} className="w-full">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </Select>
    {error ? <p role="alert" className="mt-1 text-body-sm text-danger">{error}</p> : null}
  </div>;
}
