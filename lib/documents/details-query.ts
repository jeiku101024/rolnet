import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { fleetToday } from "@/lib/dates/fleet-date";
import { demoDocumentEvents, demoDocumentVersions, demoDocuments, demoDrivers, demoOwnerName, demoUnits } from "@/lib/demo/mode";
import { documentStatus, type DocumentStatus } from "@/lib/documents/status";
import { shownFileName } from "@/lib/documents/file-label";
import { unknownUser } from "@/lib/documents/page-query";

// Feature 013 (FR-025–FR-029, contracts/actions.md "DocumentDetails"): one document (type + holder)
// as the details modal shows it, from any of its version ids.

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface DetailsVersion { id: string; fileName: string; documentNumber: string | null; issuedOn: string | null; expiresOn: string }
export interface DetailsReverted extends DetailsVersion { revertedAt: string; revertedByName: string; keptUntil: string; fileKept: boolean }
export interface DetailsActivity { id: string; kind: string; summary: string; occurredAt: string; actorName: string }
export interface DocumentDetails {
  documentType: string;
  holder: { kind: "unit" | "driver"; id: string; name: string };
  current: (DetailsVersion & { status: DocumentStatus; canRevert: boolean; hasPrevious: boolean }) | null;
  history: DetailsVersion[];
  reverted: DetailsReverted[];
  activity: DetailsActivity[];
}

export interface VersionRow {
  id: string; document_type: string; unit_id: string | null; driver_id: string | null; document_number: string | null; issued_on: string | null; expires_on: string;
  mime_type: string | null; file_name: string | null; created_at: string; created_by?: string | null; lifecycle_status: string; superseded_at: string | null;
  reverted_at: string | null; reverted_by: string | null; purge_after: string | null; file_deleted_at: string | null; deleted_at?: string | null;
}
export interface EventRow { id: string; kind: string; version_id: string; summary: string; occurred_at: string; created_by?: string | null }

/** Builds the details from rows (shared by the live and demo branches, and unit-tested). */
export function buildDocumentDetails(input: { versions: VersionRow[]; events: EventRow[]; holderName: string; names: Record<string, string>; now: Date }): DocumentDetails | null {
  const first = input.versions[0];
  if (!first) return null;
  const today = fleetToday(input.now);
  const name = (id: string | null | undefined) => (id && input.names[id]) || unknownUser;
  const version = (row: VersionRow): DetailsVersion => ({
    id: row.id, documentNumber: row.document_number, issuedOn: row.issued_on, expiresOn: row.expires_on,
    fileName: shownFileName({ fileName: row.file_name, documentType: row.document_type, holderName: input.holderName, createdAt: row.created_at, mimeType: row.mime_type }),
  });
  const live = input.versions.filter((row) => !row.deleted_at);
  const currentRow = live.find((row) => row.lifecycle_status === "current");
  const history = live.filter((row) => row.lifecycle_status === "superseded")
    .sort((a, b) => (b.superseded_at ?? "").localeCompare(a.superseded_at ?? "") || b.created_at.localeCompare(a.created_at)).map(version);
  const reverted = live.filter((row) => row.lifecycle_status === "reverted")
    .sort((a, b) => (b.reverted_at ?? "").localeCompare(a.reverted_at ?? ""))
    .map((row) => ({
      ...version(row), revertedAt: row.reverted_at!, revertedByName: name(row.reverted_by), keptUntil: row.purge_after!,
      fileKept: !row.file_deleted_at && Date.parse(row.purge_after!) > input.now.getTime(),
    }));
  const events = [...input.events].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const logged = new Set(events.filter((event) => event.kind === "uploaded" || event.kind === "renewed").map((event) => event.version_id));
  // Versions saved before feature 013 (or through the API) have no upload event: show their upload.
  const synthesized: DetailsActivity[] = live.filter((row) => !logged.has(row.id)).map((row) => ({
    id: `uploaded-${row.id}`, kind: "uploaded", occurredAt: row.created_at, actorName: name(row.created_by), summary: `Uploaded ${version(row).fileName}.`,
  }));
  const activity = [...events.map((event) => ({ id: event.id, kind: event.kind, summary: event.summary, occurredAt: event.occurred_at, actorName: name(event.created_by) })), ...synthesized]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 5);
  return {
    documentType: first.document_type,
    holder: first.unit_id ? { kind: "unit", id: first.unit_id, name: input.holderName } : { kind: "driver", id: first.driver_id!, name: input.holderName },
    current: currentRow ? {
      ...version(currentRow), status: documentStatus(currentRow.expires_on, today),
      canRevert: events[0]?.kind !== "restored", hasPrevious: history.length > 0,
    } : null,
    history, reverted, activity,
  };
}

const versionColumns = "id, document_type, unit_id, driver_id, document_number, issued_on, expires_on, mime_type, file_name, created_at, created_by, lifecycle_status, superseded_at, reverted_at, reverted_by, purge_after, file_deleted_at, deleted_at";

export async function loadDocumentDetails(s: Supabase | null, id: string, now = new Date()): Promise<DocumentDetails | null> {
  if (!s) {
    const all = [...demoDocuments, ...demoDocumentVersions];
    const seed = all.find((row) => row.id === id);
    if (!seed) return null;
    const versions = all.filter((row) => row.document_type === seed.document_type && row.unit_id === seed.unit_id && row.driver_id === seed.driver_id)
      .map((row) => ({ ...row, created_by: "demo-owner" }));
    const events = demoDocumentEvents.filter((event) => event.document_type === seed.document_type && event.unit_id === seed.unit_id && event.driver_id === seed.driver_id)
      .map((event) => ({ ...event, created_by: "demo-owner" }));
    const holderName = seed.unit_id ? demoUnits.find((unit) => unit.id === seed.unit_id)?.name ?? "Unit" : demoDrivers.find((driver) => driver.id === seed.driver_id)?.full_name ?? "Driver";
    return buildDocumentDetails({ versions, events, holderName, names: { "demo-owner": demoOwnerName }, now });
  }
  const { data: seed, error } = await s.from("documents").select("document_type, unit_id, driver_id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!seed) return null;
  const [holderColumn, holderId] = seed.unit_id ? ["unit_id", seed.unit_id as string] : ["driver_id", seed.driver_id as string];
  const [versions, events, holderRow] = await Promise.all([
    s.from("documents").select(versionColumns).eq("document_type", seed.document_type as string).eq(holderColumn, holderId),
    s.from("document_events").select("id, kind, version_id, summary, occurred_at, created_by").eq("document_type", seed.document_type as string).eq(holderColumn, holderId),
    seed.unit_id
      ? s.from("units").select("name").eq("id", seed.unit_id as string).maybeSingle()
      : s.from("drivers").select("full_name").eq("id", seed.driver_id as string).maybeSingle(),
  ]);
  if (versions.error) throw versions.error;
  if (events.error) throw events.error;
  const versionRows = (versions.data ?? []) as VersionRow[];
  const eventRows = (events.data ?? []) as EventRow[];
  const ids = [...new Set([...versionRows.flatMap((row) => [row.created_by, row.reverted_by]), ...eventRows.map((event) => event.created_by)].filter((value): value is string => Boolean(value)))];
  const { data: profiles } = ids.length ? await s.from("profiles").select("user_id, display_name").in("user_id", ids) : { data: [] };
  const holderData = holderRow.data as { name?: string; full_name?: string } | null;
  return buildDocumentDetails({
    versions: versionRows, events: eventRows, now,
    holderName: holderData?.name ?? holderData?.full_name ?? "Unknown",
    names: Object.fromEntries((profiles ?? []).map((profile) => [profile.user_id as string, profile.display_name as string])),
  });
}
