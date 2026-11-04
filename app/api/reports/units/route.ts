import { connection, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoMode } from "@/lib/demo/mode";
import { validatePeriod, type ReportKind } from "@/lib/reports/periods";
import { jsonError, reportsGuard } from "@/lib/reports/http";
import { loadReportUnits } from "@/lib/reports/report-data";
import { toUnitChoice } from "@/lib/reports/units-response";

// Feature 014 (contracts/reports-http.md): the units a report covers for a period, for the Single unit
// dropdown. Every non-archived unit, plus archived units with a remittance or expense in the period.

const periodParam: Record<ReportKind, string> = { weekly: "date", monthly: "month", yearly: "year" };

export async function GET(request: Request) {
  await connection();
  try {
    const denied = await reportsGuard();
    if (denied) return denied;
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    if (kind !== "weekly" && kind !== "monthly" && kind !== "yearly") return jsonError(400, "INVALID_QUERY", "Choose a Weekly, Monthly or Yearly report.");
    const period = validatePeriod(kind, url.searchParams.get(periodParam[kind]));
    if ("error" in period) return jsonError(400, "INVALID_QUERY", period.error);
    const supabase = demoMode ? null : await createSupabaseServerClient();
    const units = await loadReportUnits(supabase, period.range);
    return NextResponse.json({ units: units.map(toUnitChoice) }, { headers: { "cache-control": "no-store" } });
  } catch (reason) {
    console.error("Report units failed", reason);
    return jsonError(500, "UNEXPECTED", "The units could not be loaded. Try again.");
  }
}
