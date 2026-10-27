import { ApiError } from "./errors";

export function etagValue(updatedAt: string) { return `"${updatedAt}"`; }

export function requireIfMatch(request: Request) {
  const value = request.headers.get("if-match");
  if (!value) throw new ApiError(428, "PRECONDITION_REQUIRED", "Reload this record before changing it.");
  return value.replace(/^W\//, "").replace(/^"|"$/g, "");
}
