import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/guards";
import { hasPermission, isApproved } from "@/lib/permissions/roles";

// Feature 014 (contracts/reports-http.md): what both report routes share. The guard is checked here instead of
// with requirePermission(), whose redirect() would be caught and turned into a 403 for every failure.

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** The error response when the caller may not use reports, or null when they may. */
export async function reportsGuard() {
  const profile = await getSessionProfile();
  if (!profile) return jsonError(401, "UNAUTHENTICATED", "Sign in to download reports.");
  if (!isApproved(profile.accountStatus)) return jsonError(403, "ACCOUNT_NOT_APPROVED", "Your account is not approved yet.");
  if (!hasPermission(profile.role, "export_reports")) return jsonError(403, "FORBIDDEN", "Only the owner can download reports.");
  return null;
}
