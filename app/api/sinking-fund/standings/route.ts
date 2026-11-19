import { connection } from "next/server";
import { getSessionProfile } from "@/lib/auth/guards";
import { fleetToday } from "@/lib/dates/fleet-date";
import { isApproved } from "@/lib/permissions/roles";
import { isDownloadableMonth } from "@/lib/reports/download-years";
import { jsonError } from "@/lib/reports/http";
import { monthRange } from "@/lib/reports/periods";
import { xlsxContentType } from "@/lib/reports/xlsx";
import { loadStandings } from "@/lib/sinking-fund/queries";
import { buildStandingsWorkbook, standingsFileName } from "@/lib/sinking-fund/standings-workbook";

// Feature 019 (contracts/sinking-fund-standings.md): the monthly standings Excel file, owner only. As in the
// distribution download, `connection()` comes first and outside the try so a prerender ends instead of being logged
// as a failure. The sheet has a few dozen rows, so the file is built here.

export async function GET(request: Request) {
  await connection();
  try {
    const profile = await getSessionProfile();
    if (!profile) return jsonError(401, "UNAUTHENTICATED", "Sign in to download this file.");
    if (!isApproved(profile.accountStatus)) return jsonError(403, "ACCOUNT_NOT_APPROVED", "Your account is not approved yet.");
    if (profile.role !== "owner") return jsonError(403, "FORBIDDEN", "Only the owner can download this.");

    const today = fleetToday();
    const month = new URL(request.url).searchParams.get("month");
    if (!isDownloadableMonth(month, today)) return jsonError(400, "INVALID_QUERY", "Choose a valid month.");

    const lastDay = monthRange(month).to;
    const isCurrentMonth = month === today.slice(0, 7);
    const asOf = lastDay < today ? lastDay : today;
    const bytes = await buildStandingsWorkbook(await loadStandings(asOf), { month, asOf, isCurrentMonth });
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": xlsxContentType,
        "content-disposition": `attachment; filename="${standingsFileName(month)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (reason) {
    console.error("Standings download failed", reason);
    return jsonError(500, "UNEXPECTED", "The file could not be created. Try again.");
  }
}
