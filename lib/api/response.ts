import { ApiError, normalizeApiError } from "./errors";

const privateHeaders = { "cache-control": "private, no-store" };

export function ok(data: unknown, init: ResponseInit = {}, meta?: Record<string, unknown>) {
  return Response.json(meta ? { data, meta } : { data }, { ...init, headers: { ...privateHeaders, ...init.headers } });
}

export function created(data: unknown) { return ok(data, { status: 201 }); }

export function withEtag(data: unknown, updatedAt: string, init: ResponseInit = {}) {
  return ok(data, { ...init, headers: { ...init.headers, etag: `"${updatedAt}"` } });
}

export function apiFailure(reason: unknown) {
  const error: ApiError = normalizeApiError(reason);
  return Response.json({ error: { code: error.code, message: error.message, ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}), ...(error.current ? { current: error.current } : {}) } }, { status: error.status, headers: privateHeaders });
}
