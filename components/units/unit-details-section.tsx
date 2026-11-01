"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateUnit } from "@/app/actions/units";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/page-header";
import { FormField, Input, ValidationSummary } from "@/components/ui/form-field";
import { clientErrorMessage } from "@/components/forms/use-action-form";

type Unit = { id: string; name: string; body_number: string; plate_number: string; make_model: string; current_mileage: number; updated_at: string };

/**
 * The unit page's Details section (feature 010, FR-039, FR-040): a compact grid, and "Edit details"
 * switching the four editable fields to inline inputs. Mileage, current driver and status are not
 * edited here. While the unit is In repair or Retired, the database keeps body number, plate and
 * motorcycle locked (feature 005) and the save shows that message.
 */
export function UnitDetailsSection({ unit, currentDriver, canEdit }: { unit: Unit; currentDriver: string; canEdit: boolean }) {
  const router = useRouter();
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
      const result = await updateUnit(unit.id, { name: value("name"), bodyNumber: value("bodyNumber"), plateNumber: value("plateNumber").toUpperCase(), makeModel: value("makeModel"), expectedUpdatedAt: unit.updated_at });
      if (!result.ok) { setError(result.message); return; }
      setEditing(false);
      router.refresh();
    } catch (reason) {
      setError(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  const fixed = (label: string, value: string) => <div className="grid min-w-0 gap-1"><dt className="text-label font-bold text-muted">{label}</dt><dd className="truncate text-body font-semibold text-ink">{value}</dd></div>;
  const field = (label: string, name: string, value: string, maxLength: number, className?: string) => editing
    ? <FormField label={label} required><Input name={name} defaultValue={value} maxLength={maxLength} required className={className} /></FormField>
    : fixed(label, value);

  return <form className="grid gap-4" onSubmit={save}>
    <SectionHeading title="Details" action={canEdit && !editing ? <Button type="button" variant="outline" onClick={() => { setError(undefined); setEditing(true); }}>Edit details</Button> : undefined} />
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {field("Unit name", "name", unit.name, 40)}
      {field("Body number", "bodyNumber", unit.body_number, 40)}
      {field("Plate number", "plateNumber", unit.plate_number, 20, "uppercase")}
      {field("Motorcycle", "makeModel", unit.make_model, 120)}
      {fixed("Mileage", `${unit.current_mileage.toLocaleString()} km`)}
      {fixed("Current driver", currentDriver)}
    </dl>
    <ValidationSummary message={error} />
    {editing ? <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => { setError(undefined); setEditing(false); }}>Cancel</Button>
    </div> : null}
    <Link className="muted-link w-fit text-body-sm font-semibold" href={`/expenses?unit=${unit.id}`}>Expenses</Link>
  </form>;
}
