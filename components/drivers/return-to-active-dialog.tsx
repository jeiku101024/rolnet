"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { endAbsence } from "@/app/actions/driver-absences";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ValidationSummary } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { formatAbsenceDates, type Absence } from "@/lib/drivers/absences";

/**
 * "Return [driver] to Active?" (feature 012, FR-045): choosing Active while an absence covers today
 * either keeps the absence or ends it now, optionally cancelling upcoming absences too.
 */
export function ReturnToActiveDialog({ open, onOpenChange, driverName, absence, upcomingCount }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverName: string;
  absence: Absence;
  upcomingCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [cancelUpcoming, setCancelUpcoming] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const what = absence.absence_type === "day_off" ? `On day-off ${formatAbsenceDates(absence)}.` : `On leave ${formatAbsenceDates(absence)}.`;

  async function endNow() {
    if (pending) return;
    setPending(true);
    setFailure(undefined);
    try {
      const result = await endAbsence({ id: absence.id, expectedUpdatedAt: absence.updated_at, cancelUpcoming });
      if (!result.ok) { setFailure(result.message); return; }
      onOpenChange(false);
      toast(result.data.toast);
      router.refresh();
    } catch (reason) {
      setFailure(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title={`Return ${driverName} to Active?`} description={what}>
      {upcomingCount > 0 ? <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
        <Checkbox checked={cancelUpcoming} onCheckedChange={setCancelUpcoming} />
        Also cancel {upcomingCount} upcoming {upcomingCount === 1 ? "absence" : "absences"}
      </label> : null}
      <ValidationSummary message={failure} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Keep absence</Button>
        <Button type="button" onClick={endNow} disabled={pending}>{pending ? "Ending…" : "End absence now"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
