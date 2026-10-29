import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fleetTimeZone } from "@/lib/dates/fleet-date";
import { driverStatusLabel, driverStatusOf, unitStatusLabel, type UnitStatus } from "@/lib/status/record-status";
import { SectionHeading } from "@/components/ui/page-header";

type AuditRow = { id: string; actor_user_id: string | null; occurred_at: string; changed_fields: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null };

const shown = 10;
// Status changes are a subset of the record's audit rows; this many recent rows is enough to find them.
const scanned = 100;

/**
 * The latest status changes of a unit or driver, read from the audit trail (feature 005, R7).
 * Owner-only: audit_events is readable by owners only.
 */
export async function StatusHistory({ kind, id }: { kind: "unit" | "driver"; id: string }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("audit_events").select("id, actor_user_id, occurred_at, changed_fields").eq("entity_type", kind === "unit" ? "units" : "drivers").eq("entity_id", id).neq("action", "insert").order("occurred_at", { ascending: false }).limit(scanned);
  const field = kind === "unit" ? "status" : "is_active";
  const label = (value: unknown) => kind === "unit" ? unitStatusLabel(value as UnitStatus) : driverStatusLabel(driverStatusOf(value === true));
  const changes = ((data ?? []) as AuditRow[])
    .filter((row) => row.changed_fields?.before?.[field] !== undefined && row.changed_fields.before[field] !== row.changed_fields.after?.[field])
    .slice(0, shown);
  // actor_user_id references auth.users, so names come from profiles separately.
  const actorIds = [...new Set(changes.map((row) => row.actor_user_id).filter((value): value is string => Boolean(value)))];
  const { data: profiles } = actorIds.length ? await supabase.from("profiles").select("user_id, display_name").in("user_id", actorIds) : { data: [] };
  const nameOf = (userId: string | null) => (profiles ?? []).find((profile) => profile.user_id === userId)?.display_name ?? "Unknown user";
  const time = new Intl.DateTimeFormat("en-PH", { timeZone: fleetTimeZone(), dateStyle: "medium", timeStyle: "short" });

  return <div>
    <SectionHeading title="Status history" description={`The ${shown} most recent status changes.`} />
    {changes.length ? <ul className="mt-4 divide-y divide-rule border-y border-rule">{changes.map((row) => <li key={row.id} className="py-3">
      <p className="font-semibold">{label(row.changed_fields?.before?.[field])} → {label(row.changed_fields?.after?.[field])}</p>
      <p className="text-body-sm text-muted">{nameOf(row.actor_user_id)} · {time.format(new Date(row.occurred_at))}</p>
    </li>)}</ul> : <p className="mt-4 border-y border-rule py-6 text-body-sm text-muted">No status changes recorded yet.</p>}
  </div>;
}
