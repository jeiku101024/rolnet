"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Info, Plus } from "lucide-react";
import { createDriver } from "@/app/actions/drivers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormField, Input, Select, Textarea, ValidationSummary } from "@/components/ui/form-field";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import type { DriverKind } from "@/types/database";

type Field = "fullName" | "phone" | "licenseNumber" | "licenseExpiryDate";
const required: { field: Field; message: string }[] = [
  { field: "fullName", message: "Enter the full name." },
  { field: "phone", message: "Enter the contact number." },
  { field: "licenseNumber", message: "Enter the licence number." },
  { field: "licenseExpiryDate", message: "Enter the licence expiry date." },
];

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-xs font-normal text-danger">{message}</span> : null;
}

/** "Add a driver" opens the Add driver form in a modal (feature 012, FR-010–FR-013). */
export function AddDriverDialog({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<DriverKind>("primary");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const missing = Object.fromEntries(required.filter(({ field }) => !value(field)).map(({ field, message }) => [field, message]));
    if (value("phone") && value("phone").length < 3) missing.phone = "Enter a contact number of at least 3 characters.";
    setErrors(missing);
    setFailure(undefined);
    if (Object.keys(missing).length) { setFailure("Fill in the required fields."); return; }
    setPending(true);
    try {
      const result = await createDriver({
        fullName: value("fullName"), driverKind: role, isActive: value("status") !== "inactive", phone: value("phone"),
        licenseNumber: value("licenseNumber"), licenseExpiryDate: value("licenseExpiryDate"), address: value("address") || undefined, notes: value("notes") || undefined,
      });
      if (!result.ok) { setFailure(result.message); return; }
      setOpen(false);
      toast("Driver added");
      router.refresh();
    } catch (reason) {
      setFailure(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setErrors({}); setFailure(undefined); setRole("primary"); } }}>
    <DialogTrigger render={<Button type="button" disabled={disabled} />}><Plus aria-hidden="true" size={16} />Add a driver</DialogTrigger>
    <DialogContent title="Add driver">
      <form noValidate className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" required><Input name="fullName" maxLength={160} autoComplete="off" aria-invalid={Boolean(errors.fullName) || undefined} /><FieldError message={errors.fullName} /></FormField>
          <div className="grid min-w-0 gap-2 text-sm font-medium text-ink">
            <span>Role<span aria-hidden="true" className="ml-1 text-danger">*</span></span>
            <SegmentedToggle label="Role" value={role} options={[{ value: "primary", label: "Primary" }, { value: "backup", label: "Backup" }]} onChange={setRole} />
          </div>
          <FormField label="Status"><Select name="status" defaultValue="active"><option value="active">Active</option><option value="inactive">Inactive</option></Select></FormField>
          <FormField label="Contact number" required><Input name="phone" type="tel" maxLength={40} aria-invalid={Boolean(errors.phone) || undefined} /><FieldError message={errors.phone} /></FormField>
          <FormField label="Licence number" required><Input name="licenseNumber" maxLength={80} aria-invalid={Boolean(errors.licenseNumber) || undefined} /><FieldError message={errors.licenseNumber} /></FormField>
          <FormField label="Licence expiry" required><Input name="licenseExpiryDate" type="date" aria-invalid={Boolean(errors.licenseExpiryDate) || undefined} /><FieldError message={errors.licenseExpiryDate} /></FormField>
        </div>
        <FormField label="Address"><Input name="address" maxLength={500} /></FormField>
        <FormField label="Notes"><Textarea name="notes" maxLength={1000} /></FormField>
        <p className="flex items-start gap-2 text-body-sm text-muted"><Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />Day-off and On-leave are scheduled from the driver profile, because they need dates.</p>
        <ValidationSummary message={failure} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save driver"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
