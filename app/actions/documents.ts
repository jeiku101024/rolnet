"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { documentSchema, documentUploadRequestSchema } from "@/lib/validation/documents";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";
import { documentExtension } from "@/lib/uploads/rules";

const labels = { documentType: "document type", expiresOn: "expiry date", issuedOn: "issue date", documentNumber: "document number", sizeBytes: "file size (5 MB at most)", mimeType: "file type", sha256: "file", objectPath: "file" };

function revalidateDocuments(value: { unitId?: string | null; driverId?: string | null }, id?: string) {
  revalidatePath("/documents");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/documents/${id}`);
  if (value.unitId) revalidatePath(`/units/${value.unitId}`);
  if (value.driverId) revalidatePath(`/drivers/${value.driverId}`);
}

export async function prepareDocumentUpload(input: unknown) {
  return run("Could not prepare the upload. Try again.", async () => {
    await requirePermission("manage_documents");
    const value = documentUploadRequestSchema.parse(input);
    return { objectPath: `documents/${randomUUID()}/${randomUUID()}.${documentExtension(value.mimeType)}` };
  }, labels);
}

/**
 * Saves the document record after the file is uploaded. If the holder already has a current
 * document of this type, the new one renews it through renew_compliance_document(), which keeps
 * the previous row as superseded history in the same transaction (FR-023).
 */
export async function finalizeDocumentUpload(input: unknown) {
  return run("Could not save the document. Check the details and try again.", async () => {
    await requirePermission("manage_documents");
    const v = documentSchema.parse(input);
    const s = await createSupabaseServerClient();
    const { data: existing } = await s.from("documents").select("id").eq("idempotency_key", v.idempotencyKey).maybeSingle();
    if (existing) return { id: existing.id as string, renewed: false };
    let currentQuery = s.from("documents").select("id").eq("document_type", v.documentType).eq("lifecycle_status", "current").is("deleted_at", null);
    currentQuery = v.driverId ? currentQuery.eq("driver_id", v.driverId) : currentQuery.eq("unit_id", v.unitId as string);
    const { data: current, error: currentError } = await currentQuery.maybeSingle();
    if (currentError) throw currentError;
    const fields = { document_number: v.documentNumber || null, issued_on: v.issuedOn ?? null, expires_on: v.expiresOn, object_path: v.objectPath, mime_type: v.mimeType, size_bytes: v.sizeBytes, sha256: v.sha256, idempotency_key: v.idempotencyKey };
    if (current) {
      const { data, error } = await s.rpc("renew_compliance_document", { p_previous_id: current.id, p_document: fields });
      if (error) throw error;
      revalidateDocuments(v, current.id);
      return { id: (data as { id: string }).id, renewed: true };
    }
    const { data, error } = await s.from("documents").insert({ ...fields, document_type: v.documentType, unit_id: v.unitId ?? null, driver_id: v.driverId ?? null, lifecycle_status: "current" }).select("id").single();
    if (error) throw error;
    revalidateDocuments(v);
    return { id: data.id as string, renewed: false };
  }, labels);
}

/** Short-lived (5 minute) signed link to a private document file. */
export async function getDocumentUrl(documentId: string) {
  return run("Could not open the document file. Try again.", async () => {
    await requirePermission("manage_documents");
    const id = z.string().uuid().parse(documentId);
    const s = await createSupabaseServerClient();
    const { data: doc } = await s.from("documents").select("object_path").eq("id", id).is("deleted_at", null).maybeSingle();
    if (!doc?.object_path) throw new ActionError("NOT_FOUND", "This document has no file.");
    const { data, error } = await s.storage.from("documents").createSignedUrl(doc.object_path, 300);
    if (error || !data) throw new ActionError("NOT_FOUND", "The document file could not be found. Upload it again.");
    return { url: data.signedUrl };
  });
}

export async function softDeleteDocument(id: string) {
  return run("Could not archive the document. Reload the page and try again.", async () => {
    await requirePermission("manage_documents");
    const s = await createSupabaseServerClient();
    const { data, error } = await s.from("documents").update({ deleted_at: new Date().toISOString(), lifecycle_status: "void" }).eq("id", id).is("deleted_at", null).select("id, unit_id, driver_id").maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionError("STALE_RECORD", "This document was already archived. Reload the page.");
    revalidateDocuments({ unitId: data.unit_id, driverId: data.driver_id }, id);
    return null;
  });
}
