import { documentStatuses, type DocumentStatus } from "@/lib/documents/status";

// Feature 013 (FR-009a, research R13, contracts/ui.md): each pane's search and filters and the shared
// sort live in the page address. Unknown values are dropped. The dashboard's old `expiry=due` link
// maps to Expired plus Due within 7 days in both panes.

export type DocumentSort = "expiry" | "expiry-desc" | "name" | "type";
export const documentSorts: { value: DocumentSort; label: string }[] = [
  { value: "expiry", label: "Expiry, soonest first" },
  { value: "expiry-desc", label: "Expiry, latest first" },
  { value: "name", label: "Name, A to Z" },
  { value: "type", label: "Document type" },
];

export const unitDocumentTypes = ["or_cr", "mtop_franchise", "insurance"] as const;
export type UnitDocumentType = (typeof unitDocumentTypes)[number];

export interface DocumentsUrlState {
  sort: DocumentSort;
  usearch: string;
  utype: UnitDocumentType[];
  ustatus: DocumentStatus[];
  dsearch: string;
  dstatus: DocumentStatus[];
  doc: string | null;
}

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: Params, key: string) {
  const value = params instanceof URLSearchParams ? params.get(key) : params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function list<T extends string>(raw: string, allowed: readonly T[]): T[] {
  const chosen = new Set(raw.split(",").map((part) => part.trim()).filter((part): part is T => (allowed as readonly string[]).includes(part)));
  return allowed.filter((value) => chosen.has(value));
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseDocumentsParams(params: Params): DocumentsUrlState {
  const sortRaw = read(params, "sort");
  const legacyDue = read(params, "expiry") === "due";
  const dueStatuses: DocumentStatus[] = ["expired", "due"];
  const doc = read(params, "doc");
  return {
    sort: documentSorts.some((option) => option.value === sortRaw) ? (sortRaw as DocumentSort) : "expiry",
    usearch: read(params, "usearch").slice(0, 100),
    utype: list(read(params, "utype"), unitDocumentTypes),
    ustatus: legacyDue && !read(params, "ustatus") ? dueStatuses : list(read(params, "ustatus"), documentStatuses),
    dsearch: read(params, "dsearch").slice(0, 100),
    dstatus: legacyDue && !read(params, "dstatus") ? dueStatuses : list(read(params, "dstatus"), documentStatuses),
    doc: uuid.test(doc) ? doc : null,
  };
}

/** The query string for a state, leaving out defaults. Returns "" or "?…". */
export function serializeDocumentsParams(state: DocumentsUrlState) {
  const params = new URLSearchParams();
  if (state.sort !== "expiry") params.set("sort", state.sort);
  if (state.usearch) params.set("usearch", state.usearch);
  if (state.utype.length) params.set("utype", state.utype.join(","));
  if (state.ustatus.length) params.set("ustatus", state.ustatus.join(","));
  if (state.dsearch) params.set("dsearch", state.dsearch);
  if (state.dstatus.length) params.set("dstatus", state.dstatus.join(","));
  if (state.doc) params.set("doc", state.doc);
  const text = params.toString().replaceAll("%2C", ",");
  return text ? `?${text}` : "";
}

/** The dashboard's "View all" link (FR-011a). */
export const documentsDueHref = "/documents?ustatus=expired,due&dstatus=expired,due";
