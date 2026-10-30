"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { assignBackupDriver } from "@/app/actions/assignments";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { clientErrorMessage } from "@/components/forms/use-action-form";

const pickerButton = "touch-target inline-flex items-center gap-2 rounded-md border border-control-border bg-surface px-3 text-body-sm font-semibold text-ink hover:bg-brand-soft";

/** Owner's on-card backup picker for a day off with no backup (feature 008, FR-014b). */
export function AssignBackupPicker({ dayOffId, freeDrivers }: { dayOffId: string; freeDrivers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function assign(backupDriverId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await assignBackupDriver({ dayOffId, backupDriverId });
        if (!result.ok) { setError(result.message); return; }
        setOpen(false);
        router.refresh();
      } catch (reason) {
        setError(clientErrorMessage(reason));
      }
    });
  }

  return <div className="grid gap-2">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={pickerButton}><UserPlus aria-hidden="true" size={16} />Assign driver</PopoverTrigger>
      <PopoverContent className="grid w-64 gap-2">
        <PopoverTitle className="text-label font-bold text-muted">Choose a backup driver</PopoverTitle>
        {freeDrivers.length ? <ul className="grid gap-1">{freeDrivers.map((driver) => <li key={driver.id}>
          <button type="button" className="touch-target w-full rounded-sm px-3 text-left hover:bg-brand-soft disabled:opacity-50" disabled={pending} onClick={() => assign(driver.id)}>{driver.name}</button>
        </li>)}</ul> : <p className="text-body-sm text-muted">No drivers are free on this date.</p>}
        {pending ? <p role="status" className="text-label text-muted">Assigning…</p> : null}
      </PopoverContent>
    </Popover>
    {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
  </div>;
}
