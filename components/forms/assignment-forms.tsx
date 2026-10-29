"use client";

import { useRouter } from "next/navigation";
import { assignBackupDriver, createPrimaryAssignment, endPrimaryAssignment, recordDayOff } from "@/app/actions/assignments";
import { fleetToday } from "@/lib/dates/fleet-date";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { text } from "@/components/forms/form-values";

export type DriverOption = { id: string; full_name: string; driver_kind: string; license_expiry_date: string };

function driverLabel(driver: DriverOption) {
  return `${driver.full_name} · ${driver.driver_kind === "backup" ? "backup" : "primary"} · license to ${driver.license_expiry_date}`;
}

function DriverSelect({ name, drivers, label, required, hint }: { name: string; drivers: DriverOption[]; label: string; required?: boolean; hint?: string }) {
  return <FormField label={label} required={required} hint={hint}><Select name={name} required={required} defaultValue=""><option value="">{required ? "Choose a driver" : "No backup yet"}</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driverLabel(driver)}</option>)}</Select></FormField>;
}

/** Assign (or reassign) the unit's primary driver (FR-011, US1 scenarios 2–3). */
export function PrimaryAssignmentForm({ unitId, drivers, currentDriverName }: { unitId: string; drivers: DriverOption[]; currentDriverName?: string }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const result = await createPrimaryAssignment({ unitId, driverId: text(data, "driverId"), startsOn: text(data, "startsOn"), endsOn: text(data, "endsOn"), endCurrent: data.get("endCurrent") === "on" });
    if (!result.ok) return result;
    router.refresh();
    return { ok: true, message: "Primary driver assigned." };
  })}>
    <h3 className="font-semibold">{currentDriverName ? "Reassign primary driver" : "Assign primary driver"}</h3>
    <DriverSelect name="driverId" drivers={drivers} label="Driver" required />
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Starts on" required><Input required name="startsOn" type="date" defaultValue={fleetToday()} /></FormField><FormField label="Ends on" hint="Leave empty for an open-ended assignment."><Input name="endsOn" type="date" /></FormField></div>
    {currentDriverName ? <label className="flex min-h-11 items-center gap-3 text-body-sm"><input type="checkbox" name="endCurrent" defaultChecked className="size-5" />End {currentDriverName}&rsquo;s assignment the day before</label> : null}
    <FormFooter pending={pending} status={status} label="Save assignment" />
  </FormPanel>;
}

export function EndAssignmentForm({ assignmentId, startsOn, driverName }: { assignmentId: string; startsOn: string; driverName: string }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const result = await endPrimaryAssignment({ assignmentId, endsOn: text(data, "endsOn") });
    if (!result.ok) return result;
    router.refresh();
    return { ok: true, message: "Assignment end date saved." };
  })}>
    <h3 className="font-semibold">End {driverName}&rsquo;s assignment</h3>
    <FormField label="Last operating day" required hint={`On or after ${startsOn}.`}><Input required name="endsOn" type="date" min={startsOn} defaultValue={fleetToday()} /></FormField>
    <FormFooter pending={pending} status={status} label="End assignment" />
  </FormPanel>;
}

/** Record the primary driver's day off and, optionally, the backup who covers it (US1 scenarios 5–6). */
export function DayOffForm({ assignmentId, drivers }: { assignmentId: string; drivers: DriverOption[] }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data }) => {
    const dayOff = await recordDayOff({ primaryAssignmentId: assignmentId, dayOffDate: text(data, "dayOffDate"), notes: text(data, "notes") });
    if (!dayOff.ok) return dayOff;
    router.refresh();
    const backupDriverId = text(data, "backupDriverId");
    if (!backupDriverId) return { ok: true, message: "Day off saved. Assign a backup driver below when one is available." };
    const backup = await assignBackupDriver({ dayOffId: dayOff.data.id, backupDriverId });
    if (!backup.ok) return { ok: false, message: `The day off was saved, but the backup was not assigned: ${backup.message} Choose a backup in the days-off list.` };
    return { ok: true, message: "Day off and backup driver saved." };
  })}>
    <h3 className="font-semibold">Record day off</h3>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label="Day off" required><Input required name="dayOffDate" type="date" defaultValue={fleetToday()} /></FormField><FormField label="Notes"><Input name="notes" maxLength={500} /></FormField></div>
    <DriverSelect name="backupDriverId" drivers={drivers} label="Backup driver (optional)" hint="A driver who is not operating another unit that day." />
    <FormFooter pending={pending} status={status} label="Save day off" />
  </FormPanel>;
}

/** Assign a backup to a day off that has no coverage yet. Compact for use inside a list. */
export function BackupCoverageForm({ dayOffId, drivers }: { dayOffId: string; drivers: DriverOption[] }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  return <form className="grid gap-3" onSubmit={submit(async ({ data }) => {
    const result = await assignBackupDriver({ dayOffId, backupDriverId: text(data, "backupDriverId") });
    if (!result.ok) return result;
    router.refresh();
    return { ok: true, message: "Backup driver assigned." };
  })}>
    <DriverSelect name="backupDriverId" drivers={drivers} label="Backup driver" required />
    <FormFooter pending={pending} status={status} label="Assign backup" />
  </form>;
}
