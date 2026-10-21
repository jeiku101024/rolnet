import { getAuditEvents } from "@/lib/audit/queries";
import { AuditHistory } from "@/components/audit/audit-history";
import { demoAuditEvents, demoMode } from "@/lib/demo/mode";
import { PageHeader } from "@/components/ui/page-header";

export default async function AuditPage() { const events = demoMode ? demoAuditEvents : await getAuditEvents(); return <section className="workspace"><PageHeader eyebrow="Accountability" title="Audit history" description="Review who changed important fleet records and when." /><div className="mt-8"><AuditHistory events={events} /></div></section>; }
