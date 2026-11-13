"use client";

import { useState, type FormEvent } from "react";
import { addParticipant } from "@/app/actions/sinking-fund";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea, ValidationSummary } from "@/components/ui/form-field";
import { Field, SearchableSelect, useSfSubmit } from "@/components/sinking-fund/form-kit";
import { sfMessages } from "@/lib/sinking-fund/messages";
import type { SfDriverOption } from "@/lib/sinking-fund/queries";

/** "Add participant" (spec section 5): a name, optionally imported from a driver who is not already a participant. */
export function AddParticipantDialog({ drivers, open, onOpenChange }: { drivers: SfDriverOption[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [driverId, setDriverId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const form = useSfSubmit(() => onOpenChange(false));

  function chooseDriver(id: string | null) {
    setDriverId(id);
    // Choosing a driver fills the name; "Clear" unlinks the driver and keeps whatever is typed.
    const driver = drivers.find((item) => item.id === id);
    if (driver) setName(driver.full_name);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNameError(undefined);
    if (!name.trim()) { setNameError("Enter a name."); return; }
    await form.submit(() => addParticipant({ name, driverId, notes: notes || undefined }), () => sfMessages.participantAdded);
  }

  const shownNameError = nameError ?? form.fieldErrors.name;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title="Add participant" description="A new participant starts with ₱0.00 savings. Record any earlier savings as a first deposit.">
      <form noValidate className="grid gap-4" onSubmit={onSubmit}>
        <Field label="Import from drivers" htmlFor="sf-driver" hint="Optional. Fills the name and links this participant to the driver.">
          <SearchableSelect id="sf-driver" label="Import from drivers" options={drivers.map((driver) => ({ id: driver.id, label: driver.full_name }))} value={driverId} onChange={chooseDriver} placeholder="Search drivers" clearLabel="Clear driver" />
        </Field>
        <Field label="Name" required htmlFor="sf-name" error={shownNameError}>
          <Input id="sf-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" aria-invalid={shownNameError ? true : undefined} aria-describedby={shownNameError ? "sf-name-error" : undefined} />
        </Field>
        <Field label="Notes" htmlFor="sf-notes">
          <Textarea id="sf-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
        </Field>
        <ValidationSummary message={form.failure} />
        <Button type="submit" disabled={form.pending}>{form.pending ? "Saving…" : "Save participant"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
