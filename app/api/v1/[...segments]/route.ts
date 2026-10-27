import { randomUUID } from "node:crypto";
import { apiFailure, created, ok, withEtag } from "@/lib/api/response";
import { assertSameOrigin, readIdempotencyKey, readJsonObject, readUuid } from "@/lib/api/request";
import { createRow, getRow, listRows, restoreRow, softDeleteRow, updateRow } from "@/lib/domain/crud";
import { apiContext } from "@/lib/domain/context";

type Context = { params: Promise<{ segments: string[] }> };

async function parts(context: Context) { return (await context.params).segments; }

export async function GET(request: Request, context: Context) {
  try {
    const [resource, id, child] = await parts(context);
    if (resource === "fleet-settings" && !id) {
      const result = await getRow(resource, "true");
      return result.updatedAt ? withEtag(result.data, result.updatedAt) : ok(result.data);
    }
    if (resource === "remittances" && id && child === "payments") {
      readUuid(id, "remittanceId");
      const result = await listRows("remittance-payments", new URL(request.url), { remittance_id: id });
      return ok(result.data, {}, result.meta);
    }
    if (id) {
      const result = await getRow(resource, id);
      return result.updatedAt ? withEtag(result.data, result.updatedAt) : ok(result.data);
    }
    const result = await listRows(resource, new URL(request.url));
    return ok(result.data, {}, result.meta);
  } catch (reason) { return apiFailure(reason); }
}

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const [resource, id, action] = await parts(context);
    if (id && action === "restore") {
      const result = await restoreRow(resource, id, request);
      return withEtag(result.data, result.updatedAt);
    }
    if (resource === "remittance-payments" && id && action === "correct") {
      const { supabase } = await apiContext("manage_master_data");
      const body = await readJsonObject(request);
      if (typeof body.reason !== "string" || !body.reason.trim()) throw new Error("A correction reason is required");
      const { data, error } = await supabase.rpc("correct_remittance_payment", { p_payment_id: id, p_reason: body.reason });
      if (error) throw error;
      return ok({ id, deletedAt: data });
    }
    if (resource === "remittances" && id && action === "payments") return created(await createRow("remittance-payments", request, { remittance_id: id }));
    if (resource === "remittances" && id && action === "reverse") {
      const { supabase } = await apiContext("manage_master_data");
      const body = await readJsonObject(request);
      if (typeof body.reason !== "string" || !body.reason.trim()) return apiFailure(new Error("reason required"));
      const { data, error } = await supabase.rpc("reverse_remittance", { p_remittance_id: id, p_reason: body.reason });
      if (error) throw error;
      return ok({ id, deletedAt: data });
    }
    if (resource === "profiles" && id && ["approve", "reject", "deactivate", "reactivate"].includes(action)) {
      const { supabase } = await apiContext("manage_users");
      const body = action === "reject" ? await readJsonObject(request) : {};
      const call = action === "approve" ? ["approve_staff_registration", { p_user_id: id }] as const
        : action === "reject" ? ["reject_staff_registration", { p_user_id: id, p_reason: body.reason ?? null }] as const
        : ["set_staff_account_status", { p_user_id: id, p_status: action === "reactivate" ? "approved" : "deactivated" }] as const;
      const { data, error } = await supabase.rpc(call[0], call[1]);
      if (error) throw error;
      return ok(data);
    }
    if (resource === "documents" && id === "uploads" && action === "prepare") {
      await apiContext("manage_documents");
      const body = await readJsonObject(request);
      const documentId = randomUUID();
      const filename = String(body.filename ?? "document");
      const extension = filename.includes(".") ? filename.split(".").pop() : "bin";
      return ok({ documentId, objectPath: `documents/${documentId}/${randomUUID()}.${extension}` });
    }
    if (resource === "documents" && id && action === "signed-url") {
      const { supabase } = await apiContext("manage_documents");
      const row = await supabase.from("documents").select("object_path").eq("id", id).is("deleted_at", null).maybeSingle();
      if (row.error || !row.data) throw row.error ?? new Error("not found");
      const signed = await supabase.storage.from("documents").createSignedUrl(row.data.object_path, 300);
      if (signed.error) throw signed.error;
      return ok({ url: signed.data.signedUrl, expiresIn: 300 });
    }
    if (resource === "documents" && id && action === "finalize") {
      readIdempotencyKey(request, true);
      return created(await createRow("documents", request, { id }));
    }
    if (resource === "expenses" && id && action === "receipt") {
      const operation = (await parts(context))[3];
      const { supabase } = await apiContext("encode_operations");
      if (operation === "prepare") {
        const body = await readJsonObject(request);
        const mimeType = String(body.mimeType ?? "");
        if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new Error("Unsupported receipt type");
        const extension = mimeType.split("/")[1];
        return ok({ objectPath: `receipts/${id}/${randomUUID()}.${extension}` });
      }
      if (operation === "finalize") {
        const key = readIdempotencyKey(request, true);
        const body = await readJsonObject(request);
        const { data, error } = await supabase.from("expenses").update({ receipt_object_path: body.objectPath, receipt_mime_type: body.mimeType, receipt_size_bytes: body.sizeBytes, receipt_sha256: body.sha256, receipt_finalize_key: key }).eq("id", id).is("deleted_at", null).select().single();
        if (error) throw error;
        return ok(data);
      }
    }
    if (resource === "tire-installations" && id && action === "replace") {
      const { supabase } = await apiContext("encode_operations");
      const body = await readJsonObject(request);
      const { data, error } = await supabase.rpc("replace_tire_installation", { p_current_id: id, p_replacement: body });
      if (error) throw error;
      return created(data);
    }
    return created(await createRow(resource, request));
  } catch (reason) { return apiFailure(reason); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const [resource, id] = await parts(context);
    if (!id && resource !== "fleet-settings") return apiFailure(new Error("id required"));
    const result = await updateRow(resource, id ?? "true", request);
    return withEtag(result.data, result.updatedAt);
  } catch (reason) { return apiFailure(reason); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const [resource, id] = await parts(context);
    if (!id) return apiFailure(new Error("id required"));
    return ok(await softDeleteRow(resource, id, request));
  } catch (reason) { return apiFailure(reason); }
}
