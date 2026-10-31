import { connection, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/guards";
import { hasPermission, isApproved } from "@/lib/permissions/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoMode, demoUnits } from "@/lib/demo/mode";
import { validatePeriod, type ReportKind } from "@/lib/reports/periods";
import { fileSafe, loadReportData } from "@/lib/reports/report-data";
import { monthlySheet, weeklySheet, yearlySheet } from "@/lib/reports/report-layout";
import { workbookBytes, xlsxContentType } from "@/lib/reports/xlsx";

// Feature 009 (contracts/reports-http.md): Weekly, Monthly and Yearly .xlsx downloads for the fleet
// or one unit. The guard is checked here instead of with requirePermission(), whose redirect()
// would be caught and turned into a 403 for every failure.

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const periodParam: Record<ReportKind, string> = { weekly: "date", monthly: "month", yearly: "year" };

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isKind(value: string): value is ReportKind {
  return value === "weekly" || value === "monthly" || value === "yearly";
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  // Outside the try: during `next build` this rejects to end the prerender, which must not be
  // caught and logged as a failed report.
  await connection();
  try {
    const profile = await getSessionProfile();
    if (!profile) return jsonError(401, "UNAUTHENTICATED", "Sign in to download reports.");
    if (!isApproved(profile.accountStatus)) return jsonError(403, "ACCOUNT_NOT_APPROVED", "Your account is not approved yet.");
    if (!hasPermission(profile.role, "export_reports")) return jsonError(403, "FORBIDDEN", "Only the owner can download reports.");

    const { kind } = await params;
    if (!isKind(kind)) return jsonError(400, "INVALID_QUERY", "Choose a Weekly, Monthly or Yearly report.");
    const url = new URL(request.url);
    const period = validatePeriod(kind, url.searchParams.get(periodParam[kind]));
    if ("error" in period) return jsonError(400, "INVALID_QUERY", period.error);
    const scope = url.searchParams.get("scope") ?? "fleet";
    const unitId = url.searchParams.get("unitId")?.trim() || null;
    if (scope !== "unit" && scope !== "fleet") return jsonError(400, "INVALID_QUERY", "Choose whether to report the whole fleet or one unit.");
    if (scope === "unit" && !unitId) return jsonError(400, "INVALID_QUERY", "Choose the unit to report on.");
    if (scope === "unit" && !uuidPattern.test(unitId!)) return jsonError(400, "INVALID_QUERY", "The selected unit is not valid. Choose the unit again.");
    const selectedUnitId = scope === "unit" ? unitId : null;

    const supabase = demoMode ? null : await createSupabaseServerClient();
    let unitName: string | undefined;
    if (selectedUnitId) {
      if (supabase) {
        const { data: unit, error } = await supabase.from("units").select("name").eq("id", selectedUnitId).is("deleted_at", null).maybeSingle();
        if (error) throw error;
        unitName = unit?.name as string | undefined;
      } else {
        unitName = demoUnits.find((unit) => unit.id === selectedUnitId)?.name;
      }
      if (!unitName) return jsonError(404, "NOT_FOUND", "That unit was not found.");
    }

    const data = await loadReportData(supabase, { ...period.range, unitId: selectedUnitId });
    const sheet = kind === "weekly" ? weeklySheet(data, period.key, unitName)
      : kind === "monthly" ? monthlySheet(data, period.key, unitName)
      : yearlySheet(data, Number(period.key), unitName);
    const fileName = `rolnet-${kind}-${period.key}${unitName ? `-${fileSafe(unitName)}` : ""}.xlsx`;
    return new NextResponse(workbookBytes(sheet), {
      headers: {
        "content-type": xlsxContentType,
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "no-store",
      },
    });
  } catch (reason) {
    console.error("Report download failed", reason);
    return jsonError(500, "UNEXPECTED", "The report could not be created. Try again.");
  }
}
