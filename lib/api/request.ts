import { z } from "zod";
import { ApiError } from "./errors";

const uuid = z.uuid();

export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new ApiError(403, "FORBIDDEN", "This request must come from the ROLNET application.");
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) throw new ApiError(415, "INVALID_BODY", "Send the request as JSON.");
  let value: unknown;
  try { value = await request.json(); } catch { throw new ApiError(400, "INVALID_BODY", "The JSON body is invalid."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "INVALID_BODY", "The request body must be a JSON object.");
  return value as Record<string, unknown>;
}

export function readUuid(value: string, label = "id") {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", `${label} must be a valid UUID.`);
  return parsed.data;
}

export function readIdempotencyKey(request: Request, required = false) {
  const value = request.headers.get("idempotency-key");
  if (!value && !required) return undefined;
  const parsed = uuid.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "INVALID_BODY", "Idempotency-Key must be a UUID.");
  return parsed.data;
}
