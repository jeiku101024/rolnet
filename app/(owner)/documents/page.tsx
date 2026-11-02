import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoMode } from "@/lib/demo/mode";
import { loadDocumentsPage } from "@/lib/documents/page-query";
import { parseDocumentsParams } from "@/lib/documents/url-state";
import type { SearchParams } from "@/lib/pagination/list-page";
import { DocumentsWorkspace } from "@/components/documents/documents-workspace";

// Feature 013: Unit documents as a folder tree and Driver licenses as a list, with uploads, renewals
// and every recovery action in modals. The dashboard's old `?expiry=due` link still works (R13).
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("manage_documents");
  const params = await searchParams;
  const data = await loadDocumentsPage(demoMode ? null : await createSupabaseServerClient());
  return <DocumentsWorkspace data={data} initial={parseDocumentsParams(params)} />;
}
