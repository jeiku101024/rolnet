import { documentTypeLabels } from "@/lib/validation/documents";
import type { DocumentStatus } from "@/lib/documents/status";
import type { PageDocument, PageUnit } from "@/lib/documents/page-query";
import type { DocumentSort } from "@/lib/documents/url-state";
import { matchDocument, normalizeQuery } from "@/lib/documents/search";
import { lastPageFor, pageSize } from "@/lib/pagination/list-page";

// Feature 013 (FR-005–FR-009, FR-012–FR-016, FR-019–FR-020): the unit folder tree and the driver
// license list, filtered, searched and sorted in memory.

export interface UnitFolder { unitId: string; unitName: string; docs: PageDocument[]; expiredCount: number; dueCount: number; count: number }
export interface VisibleFolder extends UnitFolder { shown: PageDocument[]; nameMatch: boolean }

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** One folder per non-archived unit, including units with no documents (FR-012). */
export function buildUnitFolders(units: PageUnit[], docs: PageDocument[]): UnitFolder[] {
  return units.map((unit) => {
    const own = docs.filter((doc) => doc.unitId === unit.id);
    return {
      unitId: unit.id, unitName: unit.name, docs: own, count: own.length,
      expiredCount: own.filter((doc) => doc.status === "expired").length,
      dueCount: own.filter((doc) => doc.status === "due").length,
    };
  });
}

export function unitPaneCount(folders: UnitFolder[]) {
  return `${plural(folders.reduce((sum, folder) => sum + folder.count, 0), "document")} · ${plural(folders.length, "unit")}`;
}

export function licensePaneCount(licenses: PageDocument[]) {
  return `${plural(licenses.length, "license")} · ${plural(new Set(licenses.map((doc) => doc.driverId)).size, "driver")}`;
}

function typeLabel(doc: PageDocument) {
  return documentTypeLabels[doc.documentType] ?? doc.documentType;
}

/** Orders documents by the shared sort (FR-008). "Name" is the holder, then the type. */
export function compareDocuments(sort: DocumentSort) {
  return (a: PageDocument, b: PageDocument) => {
    switch (sort) {
      case "expiry-desc": return b.expiresOn.localeCompare(a.expiresOn) || a.holderName.localeCompare(b.holderName) || typeLabel(a).localeCompare(typeLabel(b));
      case "name": return a.holderName.localeCompare(b.holderName) || typeLabel(a).localeCompare(typeLabel(b)) || a.expiresOn.localeCompare(b.expiresOn);
      case "type": return typeLabel(a).localeCompare(typeLabel(b)) || a.expiresOn.localeCompare(b.expiresOn) || a.holderName.localeCompare(b.holderName);
      default: return a.expiresOn.localeCompare(b.expiresOn) || a.holderName.localeCompare(b.holderName) || typeLabel(a).localeCompare(typeLabel(b));
    }
  };
}

function passes(doc: PageDocument, types: string[], statuses: DocumentStatus[]) {
  return (!types.length || types.includes(doc.documentType)) && (!statuses.length || statuses.includes(doc.status));
}

export interface TreeView { folders: VisibleFolder[]; results: number; summary: string | null; searching: boolean }

export function filterAndSortFolders(input: { folders: UnitFolder[]; query: string; types: string[]; statuses: DocumentStatus[]; sort: DocumentSort }): TreeView {
  const q = normalizeQuery(input.query);
  const filtering = input.types.length > 0 || input.statuses.length > 0;
  const compare = compareDocuments(input.sort);
  const visible: VisibleFolder[] = [];
  for (const folder of input.folders) {
    const filtered = folder.docs.filter((doc) => passes(doc, input.types, input.statuses));
    const nameMatch = Boolean(q) && folder.unitName.toLowerCase().includes(q);
    const shown = (q && !nameMatch ? filtered.filter((doc) => matchDocument(doc, q)) : filtered).sort(compare);
    const keepEmpty = folder.count === 0 && !filtering && (!q || nameMatch);
    if (shown.length || keepEmpty) visible.push({ ...folder, shown, nameMatch });
  }
  const edge = (folder: VisibleFolder) => (input.sort === "expiry-desc" ? folder.shown[0]?.expiresOn : folder.shown[0]?.expiresOn);
  visible.sort((a, b) => {
    if (input.sort === "expiry" || input.sort === "expiry-desc") {
      const ea = edge(a);
      const eb = edge(b);
      if (ea && !eb) return -1;
      if (!ea && eb) return 1;
      if (ea && eb && ea !== eb) return input.sort === "expiry" ? ea.localeCompare(eb) : eb.localeCompare(ea);
    }
    return a.unitName.localeCompare(b.unitName, undefined, { numeric: true });
  });
  const results = visible.reduce((sum, folder) => sum + folder.shown.length, 0);
  let summary: string | null = null;
  if (q || filtering) summary = results === 0 && visible.length === 0 ? "No documents match." : `${plural(results, "result")} in ${plural(visible.length, "folder")}`;
  return { folders: visible, results, summary, searching: Boolean(q) };
}

export function filterLicenses(licenses: PageDocument[], query: string, statuses: DocumentStatus[], sort: DocumentSort) {
  const q = normalizeQuery(query);
  const rows = licenses.filter((doc) => passes(doc, [], statuses) && matchDocument(doc, q)).sort(compareDocuments(sort));
  const summary = q || statuses.length ? (rows.length ? plural(rows.length, "result") : null) : null;
  return { rows, summary };
}

/** The folders on one page of the unit pane, 10 per page like the other lists. The page is clamped. */
export function pageFolders<T>(folders: T[], requested: number) {
  const lastPage = lastPageFor(folders.length);
  const page = Math.min(Math.max(1, requested), lastPage);
  const start = (page - 1) * pageSize;
  const shown = folders.slice(start, start + pageSize);
  const label = folders.length ? `${start + 1}–${start + shown.length} of ${plural(folders.length, "folder")}` : "";
  return { folders: shown, page, lastPage, label };
}

/** The page that holds a folder, so an upload or bring back can show it. */
export function pageOfFolder(folders: { unitId: string }[], unitId: string) {
  const index = folders.findIndex((folder) => folder.unitId === unitId);
  return index < 0 ? 1 : Math.floor(index / pageSize) + 1;
}
