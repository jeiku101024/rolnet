import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { fleetToday } from "@/lib/dates/fleet-date";
import { demoDocumentVersions, demoDocuments, demoDrivers, demoOwnerName, demoUnits } from "@/lib/demo/mode";
import { documentStatus, type DocumentStatus } from "@/lib/documents/status";
import { shownFileName } from "@/lib/documents/file-label";

// Feature 013 (contracts/actions.md, "Page data"): everything the Documents page shows, in 5
// parallel reads. Search, filters and sort run in the browser (research R12).

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface PageDocument {
  id: string;
  documentType: string;
  unitId: string | null;
  driverId: string | null;
  holderName: string;
  documentNumber: string | null;
  issuedOn: string | null;
  expiresOn: string;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
}
export interface PageUnit { id: string; name: string; bodyNumber: string }
export interface PageDriver { id: string; name: string; isActive: boolean }
export interface RevertedEntry {
  id: string;
  documentType: string;
  unitId: string | null;
  driverId: string | null;
  holderName: string;
  fileName: string;
  expiresOn: string;
  revertedAt: string;
  revertedByName: string;
  keptUntil: string;
  /** True when the holder has no current document of this type (a removed first upload). */
  removed: boolean;
}
export interface DocumentsPageData {
  today: string;
  unitDocs: PageDocument[];
  licenses: PageDocument[];
  units: PageUnit[];
  drivers: PageDriver[];
  recentlyReverted: RevertedEntry[];
  purgeOverdue: boolean;
}

interface Row {
  id: string; document_type: string; unit_id: string | null; driver_id: string | null; document_number: string | null; issued_on: string | null;
  expires_on: string; mime_type: string | null; file_name: string | null; created_at: string;
}
interface RevertedRow extends Row { reverted_at: string; reverted_by: string | null; purge_after: string }

export const unknownUser = "Unknown user";
const dayMs = 86_400_000;

function toDocument(row: Row, holderName: string, today: string): PageDocument {
  return {
    id: row.id, documentType: row.document_type, unitId: row.unit_id, driverId: row.driver_id, holderName,
    documentNumber: row.document_number, issuedOn: row.issued_on, expiresOn: row.expires_on, mimeType: row.mime_type ?? "application/pdf",
    fileName: shownFileName({ fileName: row.file_name, documentType: row.document_type, holderName, createdAt: row.created_at, mimeType: row.mime_type }),
    status: documentStatus(row.expires_on, today),
  };
}

/** Builds the page data from rows (shared by the live and demo branches, and unit-tested). */
export function buildDocumentsPage(input: {
  today: string; now: Date; current: Row[]; units: PageUnit[]; drivers: PageDriver[]; reverted: RevertedRow[]; names: Record<string, string>; purgeOverdue: boolean;
}): DocumentsPageData {
  const unitName = new Map(input.units.map((unit) => [unit.id, unit.name]));
  const driverName = new Map(input.drivers.map((driver) => [driver.id, driver.name]));
  const unitDocs = input.current.filter((row) => row.unit_id && unitName.has(row.unit_id)).map((row) => toDocument(row, unitName.get(row.unit_id!)!, input.today));
  const licenses = input.current.filter((row) => row.document_type === "driver_license" && row.driver_id && driverName.has(row.driver_id))
    .map((row) => toDocument(row, driverName.get(row.driver_id!)!, input.today));
  const currentKeys = new Set(input.current.map((row) => `${row.document_type}:${row.unit_id ?? row.driver_id}`));
  const since = input.now.getTime() - 30 * dayMs;
  const recentlyReverted = input.reverted
    .filter((row) => Date.parse(row.reverted_at) >= since && Date.parse(row.purge_after) > input.now.getTime())
    .filter((row) => (row.unit_id ? unitName.has(row.unit_id) : row.driver_id ? driverName.has(row.driver_id) : false))
    .map((row) => {
      const holderName = row.unit_id ? unitName.get(row.unit_id)! : driverName.get(row.driver_id!)!;
      return {
        id: row.id, documentType: row.document_type, unitId: row.unit_id, driverId: row.driver_id, holderName, expiresOn: row.expires_on,
        fileName: shownFileName({ fileName: row.file_name, documentType: row.document_type, holderName, createdAt: row.created_at, mimeType: row.mime_type }),
        revertedAt: row.reverted_at, revertedByName: (row.reverted_by && input.names[row.reverted_by]) || unknownUser, keptUntil: row.purge_after,
        removed: !currentKeys.has(`${row.document_type}:${row.unit_id ?? row.driver_id}`),
      };
    })
    .sort((a, b) => b.revertedAt.localeCompare(a.revertedAt));
  return { today: input.today, unitDocs, licenses, units: input.units, drivers: input.drivers, recentlyReverted, purgeOverdue: input.purgeOverdue };
}

const columns = "id, document_type, unit_id, driver_id, document_number, issued_on, expires_on, mime_type, file_name, created_at";

export async function loadDocumentsPage(s: Supabase | null, now = new Date()): Promise<DocumentsPageData> {
  const today = fleetToday(now);
  if (!s) {
    const units = demoUnits.filter((unit) => !unit.archived).map((unit) => ({ id: unit.id, name: unit.name, bodyNumber: unit.body_number }));
    const drivers = demoDrivers.map((driver) => ({ id: driver.id, name: driver.full_name, isActive: driver.is_active }));
    const reverted = demoDocumentVersions.filter((row) => row.lifecycle_status === "reverted" && !row.file_deleted_at) as RevertedRow[];
    return buildDocumentsPage({ today, now, current: demoDocuments, units, drivers, reverted, names: { "demo-owner": demoOwnerName }, purgeOverdue: false });
  }
  const since = new Date(now.getTime() - 30 * dayMs).toISOString();
  const overdue = new Date(now.getTime() - 2 * dayMs).toISOString();
  const [current, units, drivers, reverted, late] = await Promise.all([
    s.from("documents").select(columns).eq("lifecycle_status", "current").is("deleted_at", null),
    s.from("units").select("id, name, body_number").eq("archived", false).is("deleted_at", null).order("name"),
    s.from("drivers").select("id, full_name, is_active").is("deleted_at", null).order("full_name"),
    s.from("documents").select(`${columns}, reverted_at, reverted_by, purge_after`).eq("lifecycle_status", "reverted").is("deleted_at", null)
      .is("file_deleted_at", null).gte("reverted_at", since).gt("purge_after", now.toISOString()).order("reverted_at", { ascending: false }),
    s.from("documents").select("id", { count: "exact", head: true }).eq("lifecycle_status", "reverted").is("file_deleted_at", null).lte("purge_after", overdue),
  ]);
  for (const result of [current, units, drivers, reverted]) if (result.error) throw result.error;
  const revertedRows = (reverted.data ?? []) as RevertedRow[];
  const ids = [...new Set(revertedRows.map((row) => row.reverted_by).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = ids.length ? await s.from("profiles").select("user_id, display_name").in("user_id", ids) : { data: [] };
  return buildDocumentsPage({
    today, now,
    current: (current.data ?? []) as Row[],
    units: (units.data ?? []).map((unit) => ({ id: unit.id as string, name: unit.name as string, bodyNumber: unit.body_number as string })),
    drivers: (drivers.data ?? []).map((driver) => ({ id: driver.id as string, name: driver.full_name as string, isActive: Boolean(driver.is_active) })),
    reverted: revertedRows,
    names: Object.fromEntries((profiles ?? []).map((profile) => [profile.user_id as string, profile.display_name as string])),
    purgeOverdue: (late.count ?? 0) > 0,
  });
}

