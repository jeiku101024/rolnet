"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeDocumentUpload, prepareDocumentUpload } from "@/app/actions/documents";
import { removeDocumentObject, uploadDocument } from "@/lib/uploads/documents";
import { sha256File } from "@/lib/uploads/hash-file";
import { documentFileProblem } from "@/lib/uploads/rules";
import { documentTypeLabels, documentTypes } from "@/lib/validation/documents";
import { FormPanel } from "@/components/ui/form-panel";
import { FormField, Input, Select } from "@/components/ui/form-field";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm } from "@/components/forms/use-action-form";
import { file, text } from "@/components/forms/form-values";

type Unit = { id: string; body_number: string; plate_number: string };
type Driver = { id: string; full_name: string; license_expiry_date: string };
/** Set when renewing an existing document: type and holder are fixed. */
type Renewal = { documentType: string; unitId: string | null; driverId: string | null; holderLabel: string };

export function DocumentForm({ units, drivers, renewal }: { units: Unit[]; drivers: Driver[]; renewal?: Renewal }) {
  const router = useRouter();
  const { pending, status, submit } = useActionForm();
  const [documentType, setDocumentType] = useState(renewal?.documentType ?? "or_cr");
  const [driverId, setDriverId] = useState(renewal?.driverId ?? "");
  const isLicense = documentType === "driver_license";
  const profileExpiry = drivers.find((driver) => driver.id === driverId)?.license_expiry_date;
  return <FormPanel className="space-y-5" onSubmit={submit(async ({ data, key }) => {
    const chosen = file(data, "file");
    if (!chosen) return { ok: false, message: "Choose the document file before uploading." };
    const problem = documentFileProblem(chosen);
    if (problem) return { ok: false, message: problem };
    const holder = renewal
      ? { unitId: renewal.unitId ?? undefined, driverId: renewal.driverId ?? undefined }
      : isLicense ? { driverId: text(data, "driverId") } : { unitId: text(data, "unitId") };
    if (!holder.unitId && !holder.driverId) return { ok: false, message: isLicense ? "Choose the driver this license belongs to." : "Choose the unit this document belongs to." };
    const metadata = { documentType, ...holder, expiresOn: text(data, "expiresOn"), issuedOn: text(data, "issuedOn"), documentNumber: text(data, "documentNumber") };
    const sha256 = await sha256File(chosen);
    const prepared = await prepareDocumentUpload({ documentType, ...holder, mimeType: chosen.type, sizeBytes: chosen.size });
    if (!prepared.ok) return prepared;
    await uploadDocument(chosen, prepared.data.objectPath);
    const saved = await finalizeDocumentUpload({ ...metadata, mimeType: chosen.type, sizeBytes: chosen.size, sha256, objectPath: prepared.data.objectPath, idempotencyKey: key("document") });
    // The record was definitely not saved, so the uploaded file would be orphaned (T134).
    if (!saved.ok) { await removeDocumentObject(prepared.data.objectPath); return saved; }
    if (renewal) { router.push(`/documents/${saved.data.id}`); return { ok: true, message: "Document renewed." }; }
    router.refresh();
    return { ok: true, message: saved.data.renewed ? "Document saved. It replaces the previous current document, which is kept as history." : "Document saved." };
  })}>
    <h2 className="font-semibold">{renewal ? `Renew for ${renewal.holderLabel}` : "Upload document"}</h2>
    {renewal ? null : <>
      <FormField label="Document type" required><Select required name="documentType" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{documentTypes.map((type) => <option key={type} value={type}>{documentTypeLabels[type]}</option>)}</Select></FormField>
      {isLicense
        ? <FormField label="Driver" required><Select required name="driverId" value={driverId} onChange={(event) => setDriverId(event.target.value)}><option value="">Choose a driver</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}</Select></FormField>
        : <FormField label="Unit" required><Select required name="unitId" defaultValue=""><option value="">Choose a unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>Body {unit.body_number} · {unit.plate_number}</option>)}</Select></FormField>}
    </>}
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Document number"><Input name="documentNumber" maxLength={120} /></FormField>
      <FormField label="Issued on"><Input name="issuedOn" type="date" /></FormField>
      <FormField label="Expiry date" required hint={isLicense ? (renewal ? "Renewing a license also updates the driver profile's expiry date." : profileExpiry ? `Must match the driver profile: ${profileExpiry}.` : "Must match the driver profile's license expiry.") : undefined}><Input required name="expiresOn" type="date" /></FormField>
    </div>
    <FormField label="File" required hint="JPG, PNG, WebP or PDF, 5 MB at most."><Input required name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" /></FormField>
    <FormFooter pending={pending} status={status} label={renewal ? "Renew document" : "Upload document"} pendingLabel="Uploading…" />
  </FormPanel>;
}
