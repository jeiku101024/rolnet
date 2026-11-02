"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateDriver } from "@/app/actions/drivers";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/page-header";
import { FormField, Input, Textarea, ValidationSummary } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { formatShortDate, fleetToday } from "@/lib/dates/fleet-date";

type Driver = { id: string; full_name: string; phone: string; license_number: string; license_expiry_date: string; address: string | null; notes: string | null; created_at: string; updated_at: string };

/**
 * The profile's Details grid (feature 012, FR-018, FR-019). "Edit details" (owner, Active drivers)
 * turns name, contact, licence, address, and notes into inputs. Role and status change only in the
 * header; date joined is read-only.
 */
export function DriverDetailsSection({ driver, role, status, canEdit }: { driver: Driver; role: string; status: string; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    setPending(true);
    setError(undefined);
    try {
      const result = await updateDriver(driver.id, {
        fullName: value("fullName"), phone: value("phone"), licenseNumber: value("licenseNumber"), licenseExpiryDate: value("licenseExpiryDate"),
        address: value("address") || undefined, notes: value("notes") || undefined, expectedUpdatedAt: driver.updated_at,
      });
      if (!result.ok) { setError(result.message); return; }
      setEditing(false);
      toast("Details saved");
      router.refresh();
    } catch (reason) {
      setError(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  const fixed = (label: string, value: string, wide = false) => <div className={`grid min-w-0 gap-1 ${wide ? "col-span-2 md:col-span-3" : ""}`}><dt className="text-label font-bold text-muted">{label}</dt><dd className={`text-body font-semibold text-ink ${wide ? "whitespace-pre-line" : "truncate"}`}>{value}</dd></div>;
  const field = (label: string, name: string, value: string, maxLength: number, options: { type?: string; required?: boolean } = {}) => editing
    ? <FormField label={label} required={options.required ?? true}><Input name={name} type={options.type} defaultValue={value} maxLength={maxLength} required={options.required ?? true} /></FormField>
    : fixed(label, value || "—");

  return <form className="grid gap-4" onSubmit={save}>
    <SectionHeading title="Details" action={canEdit && !editing ? <Button type="button" variant="outline" onClick={() => { setError(undefined); setEditing(true); }}>Edit details</Button> : undefined} />
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {field("Full name", "fullName", driver.full_name, 160)}
      {field("Contact number", "phone", driver.phone, 40, { type: "tel" })}
      {field("Licence number", "licenseNumber", driver.license_number, 80)}
      {editing ? field("Licence expiry", "licenseExpiryDate", driver.license_expiry_date, 10, { type: "date" }) : fixed("Licence expiry", formatShortDate(driver.license_expiry_date) + `, ${driver.license_expiry_date.slice(0, 4)}`)}
      {field("Address", "address", driver.address ?? "", 500, { required: false })}
      {fixed("Role", role)}
      {fixed("Status today", status)}
      {fixed("Date joined", (() => { const day = fleetToday(new Date(driver.created_at)); return `${formatShortDate(day)}, ${day.slice(0, 4)}`; })())}
      {editing
        ? <div className="col-span-2 md:col-span-3"><FormField label="Notes"><Textarea name="notes" defaultValue={driver.notes ?? ""} maxLength={1000} /></FormField></div>
        : fixed("Notes", driver.notes || "—", true)}
    </dl>
    <ValidationSummary message={error} />
    {editing ? <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => { setError(undefined); setEditing(false); }}>Cancel</Button>
    </div> : null}
  </form>;
}
