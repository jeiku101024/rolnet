import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fleetTimeZone } from "@/lib/dates/fleet-date";
import { driverStatusLabel, driverStatusOf, unitStatusLabel, type UnitStatus } from "@/lib/status/record-status";
import { SectionHeading } from "@/components/ui/page-header";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type AuditRow = { id: string; actor_user_id: string | null; occurred_at: string; changed_fields: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null };

const shown = 10;
// Status changes are a subset of the record's audit rows; this many recent rows is enough to find them.
const scanned = 100;

/**
 * The latest status changes of a unit (feature 010: unit_status_changes, FR-023) or a driver
 * (feature 005, R7: the owner-only audit trail).
 */
export async function StatusHistory({ kind, id }: { kind: "unit" | "driver"; id: string }) {
  return kind === "unit" ? <UnitStatusHistory id={id} /> : <DriverStatusHistory id={id} />;
}

async function UnitStatusHistory({ id }: { id: string }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("unit_status_changes").select("id, from_status, to_status, changed_at, changed_by").eq("unit_id", id).is("deleted_at", null).order("changed_at", { ascending: false }).limit(shown);
  const changes = (data ?? []) as { id: string; from_status: UnitStatus | null; to_status: UnitStatus; changed_at: string; changed_by: string | null }[];
  const nameOf = await actorNames(supabase, changes.map((row) => row.changed_by));
  const time = timeFormat();
  return <HistoryList items={changes.map((row) => ({
    id: row.id,
    title: row.from_status ? `${unitStatusLabel(row.from_status)} → ${unitStatusLabel(row.to_status)}` : `Created as ${unitStatusLabel(row.to_status)}`,
    detail: `${row.changed_by ? nameOf(row.changed_by) : "System"} · ${time.format(new Date(row.changed_at))}`,
  }))} />;
}

async function DriverStatusHistory({ id }: { id: string }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("audit_events").select("id, actor_user_id, occurred_at, changed_fields").eq("entity_type", "drivers").eq("entity_id", id).neq("action", "insert").order("occurred_at", { ascending: false }).limit(scanned);
  const label = (value: unknown) => driverStatusLabel(driverStatusOf(value === true));
  const changes = ((data ?? []) as AuditRow[])
    .filter((row) => row.changed_fields?.before?.is_active !== undefined && row.changed_fields.before.is_active !== row.changed_fields.after?.is_active)
    .slice(0, shown);
  const nameOf = await actorNames(supabase, changes.map((row) => row.actor_user_id));
  const time = timeFormat();
  return <HistoryList items={changes.map((row) => ({
    id: String(row.id),
    title: `${label(row.changed_fields?.before?.is_active)} → ${label(row.changed_fields?.after?.is_active)}`,
    detail: `${nameOf(row.actor_user_id)} · ${time.format(new Date(row.occurred_at))}`,
  }))} />;
}

function timeFormat() {
  return new Intl.DateTimeFormat("en-PH", { timeZone: fleetTimeZone(), dateStyle: "medium", timeStyle: "short" });
}

// Actor ids reference auth.users, so names come from profiles separately.
async function actorNames(supabase: Supabase, ids: (string | null)[]) {
  const actorIds = [...new Set(ids.filter((value): value is string => Boolean(value)))];
  const { data: profiles } = actorIds.length ? await supabase.from("profiles").select("user_id, display_name").in("user_id", actorIds) : { data: [] };
  return (userId: string | null) => (profiles ?? []).find((profile) => profile.user_id === userId)?.display_name ?? "Unknown user";
}

function HistoryList({ items }: { items: { id: string; title: string; detail: string }[] }) {
  return <div>
    <SectionHeading title="Status history" description={`The ${shown} most recent status changes.`} />
    {items.length ? <ul className="mt-4 divide-y divide-rule border-y border-rule">{items.map((item) => <li key={item.id} className="py-3">
      <p className="font-semibold">{item.title}</p>
      <p className="text-body-sm text-muted">{item.detail}</p>
    </li>)}</ul> : <p className="mt-4 border-y border-rule py-6 text-body-sm text-muted">No status changes recorded yet.</p>}
  </div>;
}
