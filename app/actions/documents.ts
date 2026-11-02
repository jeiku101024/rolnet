"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { bringBackSchema, documentIdSchema, documentSchema, documentUploadRequestSchema, restoreVersionSchema, revertDocumentSchema } from "@/lib/validation/documents";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";
import { documentExtension } from "@/lib/uploads/rules";
import { demoMode } from "@/lib/demo/mode";
import { loadDocumentDetails, type DocumentDetails } from "@/lib/documents/details-query";

const labels = { documentType: "document type", expiresOn: "expiry date", issuedOn: "issue date", documentNumber: "document number", sizeBytes: "file size (5 MB at most)", mimeType: "file type", sha256: "file", objectPath: "file", fileName: "file name" };

type Holder = { unitId?: string | null; driverId?: string | null };

function revalidateDocuments(value: Holder) {
  revalidatePath("/documents");
  revalidatePath("/dashboard");
  if (value.unitId) revalidatePath(`/units/${value.unitId}`);
  if (value.driverId) revalidatePath(`/drivers/${value.driverId}`);
}

function refuseInDemo() {
  if (demoMode) throw new ActionError("DEMO_MODE", "Demo mode doesn't save changes. Sign in to the live app to change documents.");
}

async function holderOf(s: Awaited<ReturnType<typeof createSupabaseServerClient>>, id: string): Promise<Holder> {
  const { data } = await s.from("documents").select("unit_id, driver_id").eq("id", id).maybeSingle();
  return { unitId: data?.unit_id as string | null, driverId: data?.driver_id as string | null };
}

export async function prepareDocumentUpload(input: unknown) {
  return run("Could not prepare the upload. Try again.", async () => {
    await requirePermission("manage_documents");
    refuseInDemo();
    const value = documentUploadRequestSchema.parse(input);
    return { objectPath: `documents/${randomUUID()}/${randomUUID()}.${documentExtension(value.mimeType)}` };
  }, labels);
}

/**
 * Saves the document record after the file is uploaded. A first upload becomes the current
 * version; uploading a type the holder already has renews it and moves the previous version to
 * History. save_compliance_document() does either in one transaction and logs it (feature 013, R5).
 */
export async function finalizeDocumentUpload(input: unknown) {
  return run("Could not save the document. Check the details and try again.", async () => {
    await requirePermission("manage_documents");
    refuseInDemo();
    const v = documentSchema.parse(input);
    const s = await createSupabaseServerClient();
    const { data, error } = await s.rpc("save_compliance_document", { p_document: {
      document_type: v.documentType, unit_id: v.unitId ?? null, driver_id: v.driverId ?? null, document_number: v.documentNumber || null,
      issued_on: v.issuedOn ?? null, expires_on: v.expiresOn, object_path: v.objectPath, mime_type: v.mimeType, size_bytes: v.sizeBytes,
      sha256: v.sha256, idempotency_key: v.idempotencyKey, file_name: v.fileName,
      ...(v.expectedCurrentId !== undefined ? { expected_current_id: v.expectedCurrentId } : {}),
    } });
    if (error) throw error;
    const saved = data as { version_id: string; renewed: boolean; previous_id: string | null };
    revalidateDocuments(v);
    return { id: saved.version_id, renewed: saved.renewed, previousId: saved.previous_id };
  }, labels);
}

/** Undo on the upload toast and "Revert upload" in the details modal (FR-036–FR-038). */
export async function revertDocumentUpload(input: unknown) {
  return run("Could not revert the upload. Reload the page and try again.", async () => {
    await requirePermission("manage_documents");
    refuseInDemo();
    const { currentId } = revertDocumentSchema.parse(input);
    const s = await createSupabaseServerClient();
    const { data, error } = await s.rpc("revert_document_upload", { p_current_id: currentId });
    if (error) throw error;
    const result = data as { result: "previous" | "removed"; restored_id: string | null };
    revalidateDocuments(await holderOf(s, currentId));
    return { result: result.result, restoredId: result.restored_id };
  });
}

/** Restore a History version as the current one (FR-043). */
export async function restoreDocumentVersion(input: unknown) {
  return run("Could not restore that version. Reload the page and try again.", async () => {
    await requirePermission("manage_documents");
    refuseInDemo();
    const { versionId, currentId } = restoreVersionSchema.parse(input);
    const s = await createSupabaseServerClient();
    const { data, error } = await s.rpc("restore_document_version", { p_version_id: versionId, p_current_id: currentId });
    if (error) throw error;
    const result = data as { version_id: string; moved_id: string | null };
    revalidateDocuments(await holderOf(s, versionId));
    return { id: result.version_id, movedId: result.moved_id };
  });
}

/** Bring back a reverted file while it is still kept (FR-041). */
export async function bringBackDocumentVersion(input: unknown) {
  return run("Could not bring the file back. Reload the page and try again.", async () => {
    await requirePermission("manage_documents");
    refuseInDemo();
    const { versionId, currentId } = bringBackSchema.parse(input);
    const s = await createSupabaseServerClient();
    const { data, error } = await s.rpc("bring_back_document_version", { p_version_id: versionId, p_current_id: currentId });
    if (error) throw error;
    const result = data as { result: "swapped" | "recreated"; version_id: string; moved_id: string | null };
    revalidateDocuments(await holderOf(s, versionId));
    return { result: result.result, id: result.version_id, movedId: result.moved_id };
  });
}

/** Everything the Document details modal shows, from any version id of the document (FR-025–FR-029). */
export async function getDocumentDetails(input: unknown) {
  return run<DocumentDetails>("Could not open the document. Reload the page and try again.", async () => {
    await requirePermission("manage_documents");
    const { id } = documentIdSchema.parse(input);
    const details = await loadDocumentDetails(demoMode ? null : await createSupabaseServerClient(), id);
    if (!details) throw new ActionError("NOT_FOUND", "This document was not found. Reload the page and try again.");
    return details;
  });
}

/** Short-lived (5 minute) signed link to a version's file: current, History, or a kept revert (FR-027a). */
export async function getDocumentUrl(documentId: string) {
  return run("Could not open the document file. Try again.", async () => {
    await requirePermission("manage_documents");
    const { id } = documentIdSchema.parse({ id: documentId });
    if (demoMode) throw new ActionError("DEMO_MODE", "Demo mode has no stored files to open.");
    const s = await createSupabaseServerClient();
    const { data: doc } = await s.from("documents").select("object_path, lifecycle_status, file_deleted_at, purge_after").eq("id", id).is("deleted_at", null).maybeSingle();
    if (!doc?.object_path) throw new ActionError("NOT_FOUND", "This document has no file.");
    if (doc.lifecycle_status === "reverted" && (doc.file_deleted_at || (doc.purge_after && Date.parse(doc.purge_after as string) <= Date.now()))) {
      throw new ActionError("NOT_FOUND", "This file was deleted after 30 days.");
    }
    const { data, error } = await s.storage.from("documents").createSignedUrl(doc.object_path as string, 300);
    if (error || !data) throw new ActionError("NOT_FOUND", "The document file could not be found. Upload it again.");
    return { url: data.signedUrl };
  });
}
