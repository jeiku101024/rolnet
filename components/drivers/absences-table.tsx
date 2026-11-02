"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { cancelAbsence, endAbsence } from "@/app/actions/driver-absences";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/feedback";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { AbsenceDialog } from "@/components/drivers/absence-dialog";
import { fleetToday, formatShortDate } from "@/lib/dates/fleet-date";
import {
  absenceStatus, absenceStatusLabels, absenceTypeLabels, daysOpen, formatAbsenceDates, reasonLabels, staleLevel,
  type Absence, type AbsenceStatus, type StaleSettings,
} from "@/lib/drivers/absences";

type ProfileAbsence = Absence & { lastCheckedAt: string | null };

const statusTone: Record<AbsenceStatus, StatusBadgeTone> = { upcoming: "info", active: "success", completed: "muted", cancelled: "muted", ended_early: "muted" };
const checkedDay = (timestamp: string) => fleetToday(new Date(timestamp));

/**
 * The profile's Absences tab (feature 012, FR-046, FR-047, FR-056): type, dates (note as a tooltip),
 * reason, status with the stale tag and "Checked" line, and row actions. Upcoming rows can be edited or
 * cancelled; the current one edited or ended early; the rest are read-only.
 */
export function AbsencesTable({ driver, absences, isActive, settings, today, disabled }: {
  driver: { id: string; name: string };
  absences: ProfileAbsence[];
  isActive: boolean;
  settings: StaleSettings;
  today: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProfileAbsence | null>(null);
  const [confirming, setConfirming] = useState<{ kind: "cancel" | "end"; absence: ProfileAbsence } | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!confirming) return;
    const { kind, absence } = confirming;
    setError("");
    startTransition(async () => {
      try {
        const result = kind === "cancel"
          ? await cancelAbsence({ id: absence.id, expectedUpdatedAt: absence.updated_at })
          : await endAbsence({ id: absence.id, expectedUpdatedAt: absence.updated_at, cancelUpcoming: false });
        setConfirming(null);
        if (!result.ok) { setError(result.message); return; }
        toast(result.data.toast);
        router.refresh();
      } catch (reason) {
        setError(clientErrorMessage(reason));
      }
    });
  }

  const addButton = <Button type="button" variant="outline" disabled={disabled || !isActive} onClick={() => setAdding(true)}><Plus aria-hidden="true" size={16} />Add absence</Button>;

  return <div className="grid gap-3">
    <div className="flex justify-end">
      {isActive ? addButton : <Tooltip><TooltipTrigger render={<span tabIndex={0} />}>{addButton}</TooltipTrigger><TooltipContent>Inactive drivers cannot have absences.</TooltipContent></Tooltip>}
    </div>
    {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
    {absences.length ? <Table className="data-table">
      <TableHeader><TableRow>{["Type", "Dates", "Reason", "Status", "Actions"].map((header) => <TableHead scope="col" key={header}>{header}</TableHead>)}</TableRow></TableHeader>
      <TableBody>
        {absences.map((absence) => {
          const status = absenceStatus(absence, today);
          const level = staleLevel(absence, today, settings);
          const dates = formatAbsenceDates(absence);
          return <tr key={absence.id}>
            <td>{absenceTypeLabels[absence.absence_type]}</td>
            <td className="whitespace-nowrap">{absence.note
              ? <Tooltip><TooltipTrigger render={<span tabIndex={0} className="underline decoration-dotted underline-offset-2" />}>{dates}</TooltipTrigger><TooltipContent>{absence.note}</TooltipContent></Tooltip>
              : dates}</td>
            <td>{reasonLabels[absence.reason]}</td>
            <td>
              <div className="grid justify-items-start gap-1">
                <span className="inline-flex flex-wrap items-center gap-1">
                  <StatusBadge label={absenceStatusLabels[status]} tone={statusTone[status]} />
                  {level === "amber" || level === "red" ? <span className={`status-badge ${level === "red" ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"}`}>Open {daysOpen(absence, today)} days</span> : null}
                </span>
                {absence.lastCheckedAt ? <span className="text-label text-muted">Checked {formatShortDate(checkedDay(absence.lastCheckedAt))}</span> : null}
              </div>
            </td>
            <td>{status === "upcoming" || status === "active" ? <DropdownMenu>
              <DropdownMenuTrigger disabled={disabled} className="touch-target inline-flex w-11 items-center justify-center rounded-md text-ink hover:bg-brand-soft" aria-label={`Options for ${dates}`}><MoreHorizontal aria-hidden="true" size={18} /></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setEditing(absence)}>Edit</DropdownMenuItem>
                {status === "upcoming"
                  ? <DropdownMenuItem onClick={() => setConfirming({ kind: "cancel", absence })}>Cancel</DropdownMenuItem>
                  : <DropdownMenuItem onClick={() => setConfirming({ kind: "end", absence })}>End early</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu> : <span className="sr-only">No actions</span>}</td>
          </tr>;
        })}
      </TableBody>
    </Table> : <p className="border-y border-rule py-6 text-body-sm text-muted">No absences recorded yet.</p>}
    {adding ? <AbsenceDialog open onOpenChange={(open) => { if (!open) setAdding(false); }} driver={driver} /> : null}
    {editing ? <AbsenceDialog key={editing.id} open onOpenChange={(open) => { if (!open) setEditing(null); }} driver={driver} absence={editing} /> : null}
    <AlertDialog open={confirming !== null} onOpenChange={(open) => { if (!open) setConfirming(null); }}>
      <AlertDialogContent
        title={confirming?.kind === "cancel" ? "Cancel this absence?" : "End this absence early?"}
        description={confirming ? confirming.kind === "cancel"
          ? `${absenceTypeLabels[confirming.absence.absence_type]} ${formatAbsenceDates(confirming.absence)} will no longer apply.`
          : `${driver.name} becomes available for assignment today.` : undefined}>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" />}>Back</AlertDialogClose>
          <Button type="button" onClick={confirm} disabled={pending}>{confirming?.kind === "cancel" ? "Cancel absence" : "End early"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
