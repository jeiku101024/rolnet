import { connection, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoMode } from "@/lib/demo/mode";
import { validatePeriod, type ReportKind } from "@/lib/reports/periods";
import { jsonError, reportsGuard } from "@/lib/reports/http";
import { loadDailyData, loadReportUnits, loadYearlyData } from "@/lib/reports/report-data";
import { toPayload } from "@/lib/reports/report-payload";

// Feature 014 (contracts/reports-http.md): the data behind a Weekly, Monthly or Yearly report, for all units or
// one unit, as JSON. The browser builds the .xlsx from it (research R4), because the free Workers plan's CPU
// limit is far below what a 100-unit workbook needs.

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const periodParam: Record<ReportKind, string> = { weekly: "date", monthly: "month", yearly: "year" };

function isKind(value: string): value is ReportKind {
  return value === "weekly" || value === "monthly" || value === "yearly";
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  // Outside the try: during `next build` this rejects to end the prerender, which must not be
  // caught and logged as a failed report.
  await connection();
  try {
    const denied = await reportsGuard();
    if (denied) return denied;

    const { kind } = await params;
    if (!isKind(kind)) return jsonError(400, "INVALID_QUERY", "Choose a Weekly, Monthly or Yearly report.");
    const url = new URL(request.url);
    const period = validatePeriod(kind, url.searchParams.get(periodParam[kind]));
    if ("error" in period) return jsonError(400, "INVALID_QUERY", period.error);
    const scopeParam = url.searchParams.get("scope") ?? "all";
    const scope = scopeParam === "fleet" ? "all" : scopeParam;
    const unitId = url.searchParams.get("unitId")?.trim() || null;
    if (scope !== "unit" && scope !== "all") return jsonError(400, "INVALID_QUERY", "Choose whether to report all units or a single unit.");
    if (scope === "unit" && !unitId) return jsonError(400, "INVALID_QUERY", "Choose the unit to report on.");
    if (scope === "unit" && !uuidPattern.test(unitId!)) return jsonError(400, "INVALID_QUERY", "The selected unit is not valid. Choose the unit again.");

    const supabase = demoMode ? null : await createSupabaseServerClient();
    const eligible = await loadReportUnits(supabase, period.range);
    const units = scope === "unit" ? eligible.filter((unit) => unit.id === unitId) : eligible;
    if (scope === "unit" && !units.length) return jsonError(404, "NOT_FOUND", "That unit has no report for this period. Choose another unit.");

    const single = scope === "unit" ? unitId : null;
    const payload = toPayload({
      kind,
      key: period.key,
      scope: scope === "unit" ? "unit" : "all",
      units,
      ...(kind === "yearly" ? { yearly: await loadYearlyData(supabase, Number(period.key), single) } : { daily: await loadDailyData(supabase, period.range, single) }),
    });
    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
  } catch (reason) {
    console.error("Report data failed", reason);
    return jsonError(500, "UNEXPECTED", "The report could not be created. Try again.");
  }
}
