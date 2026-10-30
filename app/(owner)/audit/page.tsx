import { getAuditEvents } from "@/lib/audit/queries";
import { AuditHistory } from "@/components/audit/audit-history";
import { demoAuditEvents, demoMode } from "@/lib/demo/mode";
import { PageHeader } from "@/components/ui/page-header";
import { PagedList, listView } from "@/components/ui/paged-list";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { auditActionLabels } from "@/lib/pagination/search-specs";

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const request = parseListPage(params);
  const result = demoMode ? pageRows(demoAuditEvents, request, (event) => `${event.entity_type} ${auditActionLabels[event.action]}`) : await getAuditEvents(request);
  const list = listView("/audit", params, request, result, { searchLabel: "Search audit history" });
  return <section className="workspace"><PageHeader eyebrow="Accountability" title="Audit history" description="Review who changed important fleet records and when." /><div className="mt-8"><PagedList list={list} hasRows={result.rows.length > 0} empty={<p className="py-6 text-body-sm text-muted">No changes recorded yet.</p>}><AuditHistory events={result.rows} /></PagedList></div></section>;
}
