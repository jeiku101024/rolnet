import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ListPageRequest } from "@/lib/pagination/list-page";
import { loadListPage } from "@/lib/pagination/search-filter";
import { searchSpecs } from "@/lib/pagination/search-specs";

/** One page of audit events, newest first, searched by record type or action (feature 006). */
export async function getAuditEvents(request: ListPageRequest, entityId?: string) {
  await requirePermission("view_audit");
  const s = await createSupabaseServerClient();
  return loadListPage(s, request, searchSpecs.audit, (from, to, filter) => {
    let q = s.from("audit_events").select("id, occurred_at, action, entity_type", { count: "exact" });
    if (entityId) q = q.eq("entity_id", entityId);
    if (filter) q = q.or(filter);
    return q.order("occurred_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
  });
}
