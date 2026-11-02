"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Info, Moon, TriangleAlert } from "lucide-react";
import { confirmLeave, endAbsence } from "@/app/actions/driver-absences";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { AbsenceDialog } from "@/components/drivers/absence-dialog";
import { addDays, fleetToday, formatShortDate } from "@/lib/dates/fleet-date";
import { daysOpen, reasonLabels, staleLevel, type Absence, type StaleSettings } from "@/lib/drivers/absences";

type ProfileAbsence = Absence & { lastCheckedAt: string | null };

function Notice({ tone, icon: Icon, children }: { tone: "muted" | "info" | "warning" | "danger"; icon: typeof Info; children: React.ReactNode }) {
  const toneClass = { muted: "bg-canvas text-muted", info: "bg-info-soft text-info", warning: "bg-warn-soft text-warn", danger: "bg-danger-soft text-danger" }[tone];
  return <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-2 rounded-md border border-current/15 p-3 text-body-sm ${toneClass}`}>
    <Icon aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
    <div className="grid min-w-0 flex-1 gap-2">{children}</div>
  </div>;
}

const checkedDay = (timestamp: string) => fleetToday(new Date(timestamp));

/**
 * Notices under the profile header (feature 012, US5 scenario 2, US6 scenario 5): Inactive, today's
 * day-off or leave (with the stale flag and its three actions), and upcoming absences.
 */
export function DriverNotices({ driver, isActive, covering, upcoming, settings, today, disabled }: {
  driver: { id: string; name: string };
  isActive: boolean;
  covering?: ProfileAbsence;
  upcoming: ProfileAbsence[];
  settings: StaleSettings;
  today: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [settingEnd, setSettingEnd] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function act(run: () => Promise<{ ok: true; data: { toast: string } } | { ok: false; message: string }>) {
    setError("");
    startTransition(async () => {
      try {
        const result = await run();
        if (!result.ok) { setError(result.message); return; }
        toast(result.data.toast);
        router.refresh();
      } catch (reason) {
        setError(clientErrorMessage(reason));
      }
    });
  }

  const notices: React.ReactNode[] = [];
  if (!isActive) {
    notices.push(<Notice key="inactive" tone="muted" icon={Info}><p>Inactive: this driver has left. Hidden from assignment dropdowns. Past records stay visible.</p></Notice>);
  } else if (covering) {
    const reason = `Reason: ${reasonLabels[covering.reason]}.`;
    if (covering.absence_type === "day_off") {
      notices.push(<Notice key="today" tone="info" icon={Moon}><p>On day-off today. Returns tomorrow. {reason}</p></Notice>);
    } else if (covering.end_date) {
      notices.push(<Notice key="today" tone="info" icon={CalendarDays}><p>On leave {formatShortDate(covering.start_date)} to {formatShortDate(covering.end_date)}. Returns {formatShortDate(addDays(covering.end_date, 1))}. {reason}</p></Notice>);
    } else {
      const level = staleLevel(covering, today, settings);
      const days = daysOpen(covering, today);
      if (level === "amber" || level === "red") {
        notices.push(<Notice key="today" tone={level === "red" ? "danger" : "warning"} icon={TriangleAlert}>
          <p>{level === "red"
            ? `On leave since ${formatShortDate(covering.start_date)}. Open for ${days} days. Consider marking Inactive if this driver is not returning.`
            : `On leave since ${formatShortDate(covering.start_date)}. Open-ended for ${days} days. Set an end date or end the leave.`} {reason}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disabled || pending} onClick={() => setSettingEnd(true)}>Set end date</Button>
            <Button type="button" size="sm" variant="outline" disabled={disabled || pending} onClick={() => act(() => endAbsence({ id: covering.id, expectedUpdatedAt: covering.updated_at, cancelUpcoming: false }))}>End leave now</Button>
            <Button type="button" size="sm" variant="outline" disabled={disabled || pending} onClick={() => act(() => confirmLeave({ id: covering.id }))}>Still on leave</Button>
          </div>
        </Notice>);
      } else {
        const checked = level === "snoozed" && covering.lastCheckedAt && covering.snoozed_until
          ? ` Checked ${formatShortDate(checkedDay(covering.lastCheckedAt))}. Flag returns ${formatShortDate(covering.snoozed_until)} if still open.` : "";
        notices.push(<Notice key="today" tone="info" icon={CalendarDays}><p>On leave since {formatShortDate(covering.start_date)}. No end date yet. {reason}{checked}</p></Notice>);
      }
    }
  }
  if (isActive && upcoming.length) {
    const next = upcoming[0];
    const text = next.absence_type === "day_off" ? `Day-off scheduled ${formatShortDate(next.start_date)}.`
      : next.end_date ? `Leave scheduled ${formatShortDate(next.start_date)} to ${formatShortDate(next.end_date)}.` : `Leave scheduled from ${formatShortDate(next.start_date)} (no end date).`;
    notices.push(<Notice key="upcoming" tone="muted" icon={CalendarDays}><p>{text}{upcoming.length > 1 ? ` +${upcoming.length - 1} more upcoming.` : ""}</p></Notice>);
  }
  if (!notices.length && !error) return null;
  return <div className="grid gap-2">
    {notices}
    {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
    {settingEnd && covering ? <AbsenceDialog open onOpenChange={(open) => { if (!open) setSettingEnd(false); }} driver={driver} absence={covering} focusEnd /> : null}
  </div>;
}
