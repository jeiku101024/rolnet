import { connection, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/guards";
import { fleetToday } from "@/lib/dates/fleet-date";
import { demoMode } from "@/lib/demo/mode";
import { loadExpensesMonth } from "@/lib/expenses/month-data";
import { isApproved } from "@/lib/permissions/roles";
import { isDownloadableMonth } from "@/lib/reports/download-years";
import { jsonError } from "@/lib/reports/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Feature 019 (contracts/expenses-month.md): one month of expenses by unit, as JSON. The browser builds the .xlsx
// from it (a workbook with a sheet for every unit is too much CPU for the free Workers plan). Any approved user may
// call it, as any approved user may open the Expenses page; reads go through the caller's session.

export async function GET(request: Request) {
  // Outside the try: during `next build` this rejects to end the prerender, which must not be logged as a failure.
  await connection();
  try {
    const profile = await getSessionProfile();
    if (!profile) return jsonError(401, "UNAUTHENTICATED", "Sign in to download this file.");
    if (!isApproved(profile.accountStatus)) return jsonError(403, "ACCOUNT_NOT_APPROVED", "Your account is not approved yet.");

    const month = new URL(request.url).searchParams.get("month");
    if (!isDownloadableMonth(month, fleetToday())) return jsonError(400, "INVALID_QUERY", "Choose a valid month.");

    const payload = await loadExpensesMonth(demoMode ? null : await createSupabaseServerClient(), month);
    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
  } catch (reason) {
    console.error("Expenses month data failed", reason);
    return jsonError(500, "UNEXPECTED", "The file could not be created. Try again.");
  }
}
