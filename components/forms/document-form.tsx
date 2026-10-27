"use client";

import { useState } from "react";
import { prepareDocumentUpload, finalizeDocumentUpload } from "@/app/actions/documents";
import { uploadDocument } from "@/lib/uploads/documents";
import { FormPanel } from "@/components/ui/form-panel";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, ValidationSummary } from "@/components/ui/form-field";

export function DocumentForm() {
  const [message, setMessage] = useState("");
  const failed = message && message !== "Document saved.";
  return <FormPanel className=" space-y-5" onSubmit={async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    try {
      if (!(file instanceof File) || !file.size) throw new Error("Choose a file before uploading.");
      const prepared = await prepareDocumentUpload({ documentType: String(form.get("documentType")), filename: file.name, mimeType: file.type });
      await uploadDocument(file, prepared.objectPath);
      await finalizeDocumentUpload({ documentType: String(form.get("documentType")), driverId: String(form.get("driverId") || "") || undefined, unitId: String(form.get("unitId") || "") || undefined, expiresOn: form.get("expiresOn"), mimeType: file.type, sizeBytes: file.size, sha256: "0".repeat(64), objectPath: prepared.objectPath });
      setMessage("Document saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save document."); }
  }}>
    <h2 className="font-semibold">Upload document</h2>
    <FormField label="Document type" required><Select required name="documentType"><option value="or_cr">OR/CR</option><option value="driver_license">Driver license</option><option value="mtop_franchise">MTOP franchise</option><option value="insurance">Insurance</option></Select></FormField>
    <FormField label="Expiry date" required><Input required name="expiresOn" type="date" /></FormField>
    <FormField label="File" required hint="JPG, PNG, WEBP, or PDF."><Input required name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" /></FormField>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit">Upload document</Button><ValidationSummary message={failed ? message : undefined} />{message === "Document saved." ? <p role="status" className="text-body-sm text-ok">{message}</p> : null}</div>
  </FormPanel>;
}
