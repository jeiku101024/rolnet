"use client";

import { useRef, useState, type FormEvent } from "react";
import { Info, X } from "lucide-react";
import { finalizeDocumentUpload, prepareDocumentUpload } from "@/app/actions/documents";
import { removeDocumentObject, uploadDocument } from "@/lib/uploads/documents";
import { sha256File } from "@/lib/uploads/hash-file";
import { documentFileProblem } from "@/lib/uploads/rules";
import { documentTypeLabels } from "@/lib/validation/documents";
import { unitDocumentTypes } from "@/lib/documents/url-state";
import type { PageDriver, PageUnit } from "@/lib/documents/page-query";
import { Button } from "@/components/ui/button";
import { Input as FileInput } from "@/components/ui/input";
import { FormField, Input, Select, ValidationSummary } from "@/components/ui/form-field";
import { clientErrorMessage } from "@/components/forms/use-action-form";

// Feature 013 (FR-030–FR-034): the one upload form, scoped by the pane that opened it. Uploading a
// type the holder already has renews it; the previous file stays in History.

export type UploadScope = "unit" | "driver";
export interface UploadPreset { documentType?: string; unitId?: string; driverId?: string }
export interface UploadSaved { id: string; renewed: boolean; documentType: string; unitId: string | null; driverId: string | null; holderName: string }
type Field = "documentType" | "holder" | "expiresOn" | "file";

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-xs font-normal text-danger">{message}</span> : null;
}

export function DocumentForm({ scope, units, drivers, preset, currentByKey, onSaved, onCancel }: {
  scope: UploadScope;
  units: PageUnit[];
  drivers: PageDriver[];
  preset?: UploadPreset;
  /** `${documentType}:${holderId}` → the current version's id, for the renewal banner and stale check. */
  currentByKey: Record<string, string>;
  onSaved: (saved: UploadSaved) => void;
  onCancel: () => void;
}) {
  const isDriver = scope === "driver";
  const fixed = Boolean(preset?.documentType && (preset.unitId || preset.driverId));
  const [documentType, setDocumentType] = useState(isDriver ? "driver_license" : preset?.documentType ?? "");
  const [holderId, setHolderId] = useState((isDriver ? preset?.driverId : preset?.unitId) ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  const holders = isDriver ? drivers.map((driver) => ({ id: driver.id, name: driver.name })) : units.map((unit) => ({ id: unit.id, name: unit.name }));
  const holderName = holders.find((holder) => holder.id === holderId)?.name ?? "";
  const currentId = documentType && holderId ? currentByKey[`${documentType}:${holderId}`] : undefined;
  const typeLabel = documentTypeLabels[documentType] ?? documentType;

  function chooseFile(chosen: File | null) {
    setFile(chosen);
    const problem = chosen ? documentFileProblem(chosen) : null;
    setErrors((previous) => ({ ...previous, file: problem ?? undefined }));
  }

  function removeFile() {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setErrors((previous) => ({ ...previous, file: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const expiresOn = value("expiresOn");
    const missing: Partial<Record<Field, string>> = {};
    if (!documentType) missing.documentType = "Choose the document type.";
    if (!holderId) missing.holder = isDriver ? "Choose the driver." : "Choose the unit.";
    if (!expiresOn) missing.expiresOn = "Enter the expiry date.";
    if (!file) missing.file = "Choose the document file.";
    else if (documentFileProblem(file)) missing.file = documentFileProblem(file) ?? undefined;
    setErrors(missing);
    setFailure(undefined);
    if (Object.keys(missing).length || !file) { setFailure("Fill in the required fields."); return; }
    setPending(true);
    try {
      const holder = isDriver ? { driverId: holderId } : { unitId: holderId };
      const prepared = await prepareDocumentUpload({ documentType, ...holder, mimeType: file.type, sizeBytes: file.size });
      if (!prepared.ok) { setFailure(prepared.message); return; }
      const sha256 = await sha256File(file);
      await uploadDocument(file, prepared.data.objectPath);
      const saved = await finalizeDocumentUpload({
        documentType, ...holder, documentNumber: value("documentNumber"), issuedOn: value("issuedOn") || undefined, expiresOn,
        mimeType: file.type, sizeBytes: file.size, sha256, objectPath: prepared.data.objectPath, idempotencyKey: idempotencyKey.current,
        fileName: file.name.slice(0, 200), expectedCurrentId: currentId ?? null,
      });
      // The record was definitely not saved, so the uploaded file would be orphaned (T134).
      if (!saved.ok) { await removeDocumentObject(prepared.data.objectPath); setFailure(saved.message); return; }
      onSaved({ id: saved.data.id, renewed: saved.data.renewed, documentType, unitId: isDriver ? null : holderId, driverId: isDriver ? holderId : null, holderName });
    } catch (reason) {
      setFailure(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return <form noValidate className="grid gap-4" onSubmit={submit}>
    <p className="text-body-sm text-muted">Uploading a type the holder already has renews it. The previous file stays in the history.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Document type" required>
        <Select name="documentType" value={documentType} disabled={isDriver || fixed} aria-invalid={Boolean(errors.documentType) || undefined}
          onChange={(event) => { setDocumentType(event.target.value); setErrors((previous) => ({ ...previous, documentType: undefined })); }}>
          {isDriver ? <option value="driver_license">{documentTypeLabels.driver_license}</option> : <>
            <option value="">Choose a document type</option>
            {unitDocumentTypes.map((type) => <option key={type} value={type}>{documentTypeLabels[type]}</option>)}
          </>}
        </Select>
        <FieldError message={errors.documentType} />
      </FormField>
      <FormField label={isDriver ? "Driver" : "Unit"} required>
        <Select name="holder" value={holderId} disabled={!documentType || fixed} aria-invalid={Boolean(errors.holder) || undefined}
          onChange={(event) => { setHolderId(event.target.value); setErrors((previous) => ({ ...previous, holder: undefined })); }}>
          <option value="">{isDriver ? "Choose a driver" : "Choose a unit"}</option>
          {holders.map((holder) => <option key={holder.id} value={holder.id}>{holder.name}</option>)}
        </Select>
        <FieldError message={errors.holder} />
      </FormField>
    </div>
    {currentId ? <p className="flex items-start gap-2 rounded-md bg-info-soft p-3 text-body-sm text-info" role="status">
      <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />{holderName} already has a {typeLabel}. This upload renews it.
    </p> : null}
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Document number"><Input name="documentNumber" maxLength={120} /></FormField>
      <FormField label="Issued on"><Input name="issuedOn" type="date" /></FormField>
      <FormField label="Expiry date" required hint={isDriver ? "Uploading a license also sets the driver's license expiry date." : undefined}>
        <Input name="expiresOn" type="date" aria-invalid={Boolean(errors.expiresOn) || undefined} onChange={() => setErrors((previous) => ({ ...previous, expiresOn: undefined }))} />
        <FieldError message={errors.expiresOn} />
      </FormField>
    </div>
    <FormField label="File" required hint="JPG, PNG, WebP or PDF, 5 MB at most.">
      <FileInput ref={fileInput} name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className={file ? "sr-only" : "min-h-11"}
        aria-invalid={Boolean(errors.file) || undefined} onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
      {file ? <span className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-md border border-rule px-3">
        <span className="min-w-0 truncate font-data text-body-sm">{file.name}</span>
        <Button type="button" variant="ghost" onClick={removeFile} aria-label={`Remove ${file.name}`}><X aria-hidden="true" size={14} />Remove</Button>
      </span> : null}
      <FieldError message={errors.file} />
    </FormField>
    <ValidationSummary message={failure} />
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      <Button type="submit" disabled={pending}>{pending ? "Uploading…" : currentId ? "Renew document" : "Upload document"}</Button>
    </div>
  </form>;
}
