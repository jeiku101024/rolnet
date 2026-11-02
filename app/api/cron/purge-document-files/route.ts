import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { purgeRevertedDocumentFiles, type PurgeClient } from "@/lib/documents/purge";

// Feature 013 (FR-047, research R10, contracts/actions.md): called once a day by
// .github/workflows/purge-document-files.yml with `Authorization: Bearer $CRON_SECRET`. It deletes the
// stored files of reverted uploads past their 30 days and stamps file_deleted_at.

function authorized(header: string | null, secret: string) {
  const given = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "CRON_SECRET is not set." } }, { status: 503 });
  if (!authorized(request.headers.get("authorization"), secret)) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Missing or wrong token." } }, { status: 401 });
  try {
    const result = await purgeRevertedDocumentFiles(createSupabaseServiceClient() as unknown as PurgeClient);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "PURGE_FAILED", message: "The purge could not finish. It will try again on the next run." } }, { status: 500 });
  }
}
