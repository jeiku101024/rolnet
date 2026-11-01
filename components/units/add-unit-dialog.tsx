"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createUnit } from "@/app/actions/units";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormField, Input, Select, ValidationSummary } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";

type Field = "name" | "bodyNumber" | "plateNumber" | "makeModel";
const required: { field: Field; label: string }[] = [
  { field: "name", label: "Unit name" },
  { field: "bodyNumber", label: "Body number" },
  { field: "plateNumber", label: "Plate number" },
  { field: "makeModel", label: "Motorcycle" },
];

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-xs font-normal text-danger">{message}</span> : null;
}

/** "Add a unit" opens the add-unit form in a modal (feature 010, FR-006). */
export function AddUnitDialog() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const value = (field: Field) => String(data.get(field) ?? "").trim();
    const missing = Object.fromEntries(required.filter(({ field }) => !value(field)).map(({ field, label }) => [field, `Enter the ${label.toLowerCase()}.`]));
    setErrors(missing);
    setFailure(undefined);
    if (Object.keys(missing).length) return;
    setPending(true);
    try {
      const result = await createUnit({ name: value("name"), bodyNumber: value("bodyNumber"), plateNumber: value("plateNumber").toUpperCase(), makeModel: value("makeModel"), status: data.get("status") });
      if (!result.ok) { setFailure(result.message); return; }
      setOpen(false);
      toast("Unit added");
      router.refresh();
    } catch (reason) {
      setFailure(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setErrors({}); setFailure(undefined); } }}>
    <DialogTrigger render={<Button type="button" />}><Plus aria-hidden="true" size={16} />Add a unit</DialogTrigger>
    <DialogContent title="Add a unit">
      <form noValidate className="grid gap-4" onSubmit={submit}>
        <FormField label="Unit name" required><Input name="name" maxLength={40} placeholder="e.g. ROLNET-1" aria-invalid={Boolean(errors.name) || undefined} /><FieldError message={errors.name} /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Body number" required><Input name="bodyNumber" maxLength={40} aria-invalid={Boolean(errors.bodyNumber) || undefined} /><FieldError message={errors.bodyNumber} /></FormField>
          <FormField label="Plate number" required><Input name="plateNumber" className="uppercase" maxLength={20} aria-invalid={Boolean(errors.plateNumber) || undefined} /><FieldError message={errors.plateNumber} /></FormField>
        </div>
        <FormField label="Motorcycle" required><Input name="makeModel" maxLength={120} placeholder="e.g. Yamaha YTX" aria-invalid={Boolean(errors.makeModel) || undefined} /><FieldError message={errors.makeModel} /></FormField>
        <FormField label="Status"><Select name="status" defaultValue="active"><option value="active">Active</option><option value="in_repair">In repair</option><option value="retired">Retired</option></Select></FormField>
        <ValidationSummary message={failure} />
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save unit"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
