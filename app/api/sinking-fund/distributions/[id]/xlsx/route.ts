import { connection } from "next/server";
import { getSessionProfile } from "@/lib/auth/guards";
import { isApproved } from "@/lib/permissions/roles";
import { jsonError } from "@/lib/reports/http";
import { xlsxContentType } from "@/lib/reports/xlsx";
import { buildDistributionWorkbook, distributionFileName } from "@/lib/sinking-fund/distribution-workbook";
import { loadDistributionDetail } from "@/lib/sinking-fund/queries";

// Feature 016 (contracts/server-actions-and-routes.md): the Excel file of one distribution, owner only. Notes from
// the Next.js route-handler guide: a GET handler is not cached by default and reading the session makes it dynamic;
// `connection()` comes first, outside the try, as in the report routes, so a prerender ends instead of being logged as
// a failure; `params` is a Promise. A distribution has at most a few dozen rows, so the file is built here (unlike the
// big fleet reports, which are built in the browser).

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const profile = await getSessionProfile();
    if (!profile) return jsonError(401, "UNAUTHENTICATED", "Sign in to download this file.");
    if (!isApproved(profile.accountStatus)) return jsonError(403, "ACCOUNT_NOT_APPROVED", "Your account is not approved yet.");
    if (profile.role !== "owner") return jsonError(403, "FORBIDDEN", "Only the owner can download this.");

    const { id } = await params;
    if (!uuidPattern.test(id)) return jsonError(400, "INVALID_QUERY", "This distribution link is not valid.");
    const detail = await loadDistributionDetail(id);
    if (!detail) return jsonError(404, "NOT_FOUND", "This distribution was not found.");

    const bytes = await buildDistributionWorkbook(detail);
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": xlsxContentType,
        "content-disposition": `attachment; filename="${distributionFileName(detail.distribution)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (reason) {
    console.error("Distribution download failed", reason);
    return jsonError(500, "UNEXPECTED", "The file could not be created. Try again.");
  }
}
