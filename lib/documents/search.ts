import { documentTypeLabels } from "@/lib/validation/documents";
import { documentStatusLabels } from "@/lib/documents/status";
import type { PageDocument } from "@/lib/documents/page-query";

// Feature 013 (FR-018, FR-022): live, case-insensitive search over the holder name, type, number,
// expiry date text, status text and file name; and the ranges to highlight.

export function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

export function matchDocument(doc: PageDocument, query: string) {
  const q = normalizeQuery(query);
  if (!q) return true;
  const fields = [doc.holderName, documentTypeLabels[doc.documentType] ?? doc.documentType, doc.documentNumber ?? "", doc.expiresOn, documentStatusLabels[doc.status], doc.fileName];
  return fields.some((field) => field.toLowerCase().includes(q));
}

export interface TextPart { text: string; match: boolean }

/** Splits text into plain and matching parts for every case-insensitive occurrence of the query. */
export function highlightParts(text: string, query: string): TextPart[] {
  const q = normalizeQuery(query);
  if (!q || !text) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const parts: TextPart[] = [];
  let from = 0;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, at + q.length)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + q.length), match: true });
    from = at + q.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}
