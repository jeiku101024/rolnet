import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoDocumentVersions, demoDocuments, demoMode } from "@/lib/demo/mode";

// Feature 013 (research R13): the separate detail page is replaced by the details modal on the
// Documents page. Old links (dashboard, unit and driver pages) open the current version of the same
// document there; a removed document lands on the page itself.
export default async function DocumentDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("manage_documents");
  const { id } = await params;
  let currentId: string | null = null;
  if (demoMode) {
    const seed = [...demoDocuments, ...demoDocumentVersions].find((row) => row.id === id);
    currentId = seed ? demoDocuments.find((row) => row.document_type === seed.document_type && row.unit_id === seed.unit_id && row.driver_id === seed.driver_id)?.id ?? null : null;
  } else {
    const s = await createSupabaseServerClient();
    const { data: seed } = await s.from("documents").select("document_type, unit_id, driver_id").eq("id", id).maybeSingle();
    if (seed) {
      let query = s.from("documents").select("id").eq("document_type", seed.document_type).eq("lifecycle_status", "current").is("deleted_at", null);
      query = seed.unit_id ? query.eq("unit_id", seed.unit_id) : query.eq("driver_id", seed.driver_id);
      const { data: current } = await query.maybeSingle();
      currentId = (current?.id as string | undefined) ?? null;
    }
  }
  redirect(currentId ? `/documents?doc=${currentId}` : "/documents");
}
