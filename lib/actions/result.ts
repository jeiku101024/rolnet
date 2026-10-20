export type ActionSuccess<T> = { ok: true; data: T; message?: string };
export type ActionFailure = { ok: false; code: string; message: string; fieldErrors?: Record<string, string[]> };
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export function success<T>(data: T, message?: string): ActionSuccess<T> {
  return message ? { ok: true, data, message } : { ok: true, data };
}

export function failure(code: string, message: string, fieldErrors?: Record<string, string[]>): ActionFailure {
  return fieldErrors ? { ok: false, code, message, fieldErrors } : { ok: false, code, message };
}
