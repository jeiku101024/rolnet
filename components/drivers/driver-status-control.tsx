"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { driverReleasePreview, setDriverStatus } from "@/app/actions/drivers";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { AbsenceDialog } from "@/components/drivers/absence-dialog";
import { ReleaseConfirm } from "@/components/drivers/release-confirm-dialog";
import { ReturnToActiveDialog } from "@/components/drivers/return-to-active-dialog";
import { statusTodayLabels, type Absence, type StatusToday } from "@/lib/drivers/absences";

const toneClass: Record<StatusToday, string> = {
  active: "bg-ok-soft! text-ok! border-ok/30!",
  day_off: "bg-info-soft! text-info! border-info/30!",
  on_leave: "bg-info-soft! text-info! border-info/30!",
  inactive: "bg-canvas! text-muted!",
};

const order: StatusToday[] = ["active", "day_off", "on_leave", "inactive"];
const ownerOnly = "Only the owner can change this.";

/**
 * The profile's Status dropdown (feature 012, contracts/ui.md). It shows the status today. Day-off and
 * On-leave open the absence dialog; Active ends a covering absence or reactivates an Inactive driver;
 * Inactive confirms the assignments it releases. Marking Inactive and reactivating are owner-only (FR-050).
 */
export function DriverStatusControl({ driver, status, isOwner, covering, upcoming, disabled }: {
  driver: { id: string; name: string };
  status: StatusToday;
  isOwner: boolean;
  /** The absence covering today, if any. */
  covering?: Absence;
  upcoming: Absence[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [absenceType, setAbsenceType] = useState<"day_off" | "on_leave" | null>(null);
  const [returning, setReturning] = useState(false);
  const [releaseRows, setReleaseRows] = useState<{ date: string; unitName: string; kept: boolean }[] | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function setActive(next: "active" | "inactive") {
    startTransition(async () => {
      try {
        const result = await setDriverStatus({ id: driver.id, status: next, expectedStatus: next === "active" ? "inactive" : "active" });
        if (!result.ok) { setError(result.message); return; }
        setReleaseRows(null);
        if (next === "active") toast(`${driver.name} is Active again`);
        router.refresh();
      } catch (reason) {
        setError(clientErrorMessage(reason));
      }
    });
  }

  function change(next: StatusToday) {
    setError("");
    if (next === status) return;
    if (next === "day_off" || next === "on_leave") {
      if (status === "inactive") { toast("Inactive drivers cannot have absences"); return; }
      setAbsenceType(next);
      return;
    }
    if (next === "active") {
      if (status === "inactive") { if (isOwner) setActive("active"); return; }
      if (covering) setReturning(true);
      return;
    }
    if (!isOwner) return;
    startTransition(async () => {
      try {
        const result = await driverReleasePreview({ id: driver.id });
        if (!result.ok) { setError(result.message); return; }
        if (result.data.assignments.length) setReleaseRows(result.data.assignments); else setActive("inactive");
      } catch (reason) {
        setError(clientErrorMessage(reason));
      }
    });
  }

  const optionDisabled = (option: StatusToday) => !isOwner && (option === "inactive" || (option === "active" && status === "inactive"));

  return <div className="relative inline-block">
    <Select aria-label={`Status for ${driver.name}`} value={status} disabled={disabled || pending} onChange={(event) => change(event.target.value as StatusToday)}
      className={`w-auto min-h-0! h-8.5! rounded-md! py-0! pl-3! pr-8! text-body-sm! font-bold ${toneClass[status]}`}>
      {order.map((option) => <option key={option} value={option} disabled={optionDisabled(option)} title={optionDisabled(option) ? ownerOnly : undefined} className="bg-surface font-normal text-ink">
        {statusTodayLabels[option]}{optionDisabled(option) ? " (owner only)" : ""}
      </option>)}
    </Select>
    {error ? <p role="alert" className="absolute top-full right-0 z-10 mt-1 w-64 rounded-md border border-danger/30 bg-surface p-2 text-body-sm text-danger shadow-md">
      {error} <button type="button" className="font-semibold underline" onClick={() => setError("")}>Dismiss</button>
    </p> : null}
    {absenceType ? <AbsenceDialog key={absenceType} open onOpenChange={(open) => { if (!open) setAbsenceType(null); }} driver={driver} initialType={absenceType} /> : null}
    {returning && covering ? <ReturnToActiveDialog open onOpenChange={setReturning} driverName={driver.name} absence={covering} upcomingCount={upcoming.length} /> : null}
    <Dialog open={releaseRows !== null} onOpenChange={(open) => { if (!open) setReleaseRows(null); }}>
      <DialogContent title="Release assignments?" description={`Marking ${driver.name} Inactive releases these assignments.`}>
        {releaseRows ? <ReleaseConfirm rows={releaseRows} pending={pending} onBack={() => setReleaseRows(null)} onConfirm={() => setActive("inactive")} confirmLabel="Release and mark Inactive" /> : null}
      </DialogContent>
    </Dialog>
  </div>;
}
