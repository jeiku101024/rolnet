import { auditActionLabels } from "@/lib/pagination/search-specs";

type Event = { id: number; occurred_at: string; action: string; entity_type: string };

export function AuditHistory({ events }: { events: Event[] }) {
  return <ul className="divide-y divide-rule">{events.map((e) => <li className="grid gap-1 py-3 text-body-sm sm:grid-cols-[12rem_1fr]" key={e.id}><span className="font-data text-muted">{e.occurred_at}</span><span>{auditActionLabels[e.action] ?? e.action} · {e.entity_type.replaceAll("_", " ")}</span></li>)}</ul>;
}
