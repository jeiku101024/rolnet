import { connection, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/guards";
import { hasPermission, isApproved } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { monthlyCsv } from "@/lib/reports/monthly-csv";
import { demoMode, demoUnits } from "@/lib/demo/mode";

// contracts/http.md: 400 invalid parameters, 401 signed out, 403 not an approved owner,
// 404 unknown unit. The guard is checked here instead of with requirePermission(), whose
// redirect() was previously caught and turned into a 403 for every failure.

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  // Outside the try: during `next build` this rejects to end the prerender, which must not be
  // caught and logged as a failed report.
  await connection();
  try {
    const profile = await getSessionProfile();
    if (!profile) return jsonError(401, "UNAUTHENTICATED", "Sign in to download reports.");
    if (!isApproved(profile.accountStatus)) return jsonError(403, "ACCOUNT_NOT_APPROVED", "Your account is not approved yet.");
    if (!hasPermission(profile.role, "export_reports")) return jsonError(403, "FORBIDDEN", "Only the owner can download reports.");

    const url = new URL(request.url);
    const month = url.searchParams.get("month");
    const scope = url.searchParams.get("scope");
    const unitId = url.searchParams.get("unitId")?.trim() || null;
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return jsonError(400, "INVALID_QUERY", "Choose a valid month (YYYY-MM).");
    if (scope !== "unit" && scope !== "fleet") return jsonError(400, "INVALID_QUERY", "Choose whether to report the whole fleet or one unit.");
    if (scope === "unit" && !unitId) return jsonError(400, "INVALID_QUERY", "Choose the unit to report on.");
    if (unitId && !uuidPattern.test(unitId)) return jsonError(400, "INVALID_QUERY", "The selected unit is not valid. Choose the unit again.");
    const selectedUnitId = scope === "unit" ? unitId : null;

    if (demoMode) {
      const units = demoUnits.filter((unit) => !selectedUnitId || unit.id === selectedUnitId);
      if (selectedUnitId && !units.length) return jsonError(404, "NOT_FOUND", "That unit was not found.");
      return new NextResponse(monthlyCsv(month, units.map((unit) => ({ unit_id: unit.id, body_number: unit.body_number, plate_number: unit.plate_number, remittance_due_centavos: 18000, remittance_paid_centavos: 18000, outstanding_centavos: 0, credit_centavos: 0, total_expense_centavos: 0, net_income_centavos: 18000 }))), { headers: { "content-type": "text/csv; charset=utf-8" } });
    }

    const supabase = await createSupabaseServerClient();
    let unitLabel = "fleet";
    if (selectedUnitId) {
      const { data: unit, error: unitError } = await supabase.from("units").select("id, body_number").eq("id", selectedUnitId).is("deleted_at", null).maybeSingle();
      if (unitError) throw unitError;
      if (!unit) return jsonError(404, "NOT_FOUND", "That unit was not found or has been archived.");
      unitLabel = String(unit.body_number).replace(/[^A-Za-z0-9-]+/g, "-");
    }
    const { data, error } = await supabase.rpc("monthly_report", { month_start: `${month}-01`, selected_unit_id: selectedUnitId });
    if (error) throw error;
    return new NextResponse(monthlyCsv(month, data ?? []), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="rolnet-${month}-${scope === "unit" ? `unit-${unitLabel}` : "fleet"}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (reason) {
    console.error("Monthly report failed", reason);
    return jsonError(500, "INTERNAL_ERROR", "The report could not be created. Try again.");
  }
}
