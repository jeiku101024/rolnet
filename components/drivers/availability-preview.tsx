"use client";

import { useEffect, useState, useTransition } from "react";
import { previewAvailability } from "@/app/actions/drivers";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/form-field";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { formatShortDate } from "@/lib/dates/fleet-date";
import type { Availability } from "@/lib/drivers/availability";

const hiddenLabels: [keyof Availability["hidden"], string][] = [
  ["absent", "on day-off or leave"],
  ["inactive", "inactive"],
  ["assigned", "already assigned"],
  ["licenceExpired", "licence expired"],
];

/**
 * "Available for assignment: N of M · Preview dropdown" (feature 012, FR-008, FR-009): who the Units
 * Assign driver dropdown offers on a chosen date, and how many drivers are hidden and why.
 */
export function AvailabilityPreview({ available, total, today }: { available: number; total: number; today: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<Availability | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !date) return;
    startTransition(async () => {
      try {
        const response = await previewAvailability({ date });
        if (response.ok) { setResult(response.data); setError(""); } else setError(response.message);
      } catch (reason) {
        setError(clientErrorMessage(reason));
      }
    });
  }, [open, date]);

  const hidden = result ? hiddenLabels.filter(([key]) => result.hidden[key] > 0).map(([key, label]) => `${result.hidden[key]} ${label}`) : [];

  return <span className="inline-flex flex-wrap items-center gap-x-2 text-body-sm text-muted">
    <span>Available for assignment: <span className="font-data font-semibold text-ink">{available} of {total}</span></span>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="touch-target inline-flex items-center font-semibold text-brand-dark underline underline-offset-2">Preview dropdown</PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-3">
        <PopoverTitle className="text-body-sm font-bold">What the Assign driver dropdown lists on {date ? formatShortDate(date) : "this date"}</PopoverTitle>
        <label className="grid gap-1 text-label font-semibold text-muted">Date<Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        {error ? <p role="alert" className="text-danger">{error}</p> : null}
        {pending && !result ? <p className="text-muted">Loading…</p> : null}
        {result ? <>
          {result.available.length
            ? <ul className="grid max-h-56 gap-1 overflow-y-auto">{result.available.map((driver) => <li key={driver.id}>{driver.name} <span className="text-muted">({driver.role === "backup" ? "Backup" : "Primary"})</span></li>)}</ul>
            : <p className="text-muted">No drivers are available on this date.</p>}
          {hidden.length ? <p className="text-muted">Hidden on this date: {hidden.join(" · ")}</p> : null}
        </> : null}
        <p className="text-label text-muted">Stale leave flags don&apos;t change who is available.</p>
      </PopoverContent>
    </Popover>
  </span>;
}
