import { ZodError } from "zod";

export type ApiErrorCode =
  | "INVALID_BODY" | "INVALID_QUERY" | "UNAUTHENTICATED" | "ACCOUNT_NOT_APPROVED"
  | "FORBIDDEN" | "NOT_FOUND" | "STALE_RECORD" | "PRECONDITION_REQUIRED"
  | "IDEMPOTENCY_CONFLICT" | "IMMUTABLE_FIELD" | "RESTORE_CONFLICT"
  | "DUPLICATE_RECORD" | "CATEGORY_IN_USE" | "UPLOAD_MISMATCH" | "UNSUPPORTED_FILE"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly current?: unknown,
  ) { super(message); }
}

export function normalizeApiError(reason: unknown): ApiError {
  if (reason instanceof ApiError) return reason;
  if (reason instanceof ZodError) {
    const flattened = reason.flatten();
    return new ApiError(400, "INVALID_BODY", "Check the highlighted fields and try again.", flattened.fieldErrors);
  }
  const value = reason as { code?: string; message?: string } | null;
  if (value?.code === "23505" || value?.code === "23P01") return new ApiError(409, "DUPLICATE_RECORD", "That record conflicts with an existing record.");
  if (value?.code === "23503" || value?.code === "23514") return new ApiError(409, "RESTORE_CONFLICT", "The change conflicts with related fleet records.");
  if (value?.code === "42501") return new ApiError(403, "FORBIDDEN", "You do not have permission to do that.");
  return new ApiError(500, "INTERNAL_ERROR", "The request could not be completed. Please try again.");
}
