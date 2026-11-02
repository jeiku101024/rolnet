"use client";

import { ChevronDown, ChevronRight, FileImage, FileText, Folder, FolderOpen } from "lucide-react";
import { ExpiryStatus } from "@/components/documents/expiry-status";
import { Highlight } from "@/components/documents/highlight";
import { useTreeKeyboard, type TreeRow } from "@/hooks/use-tree-keyboard";
import { isPdf } from "@/lib/documents/file-label";
import type { VisibleFolder } from "@/lib/documents/tree";
import { documentTypeLabels } from "@/lib/validation/documents";

// Feature 013 (FR-012–FR-017): one folder per unit, like a file explorer. Folders show pills and a
// count; documents sit indented under a guide line. The whole tree is one tab stop.

const row = "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand";

export function UnitTree({ folders, isOpen, onToggle, onOpenDocument, onUpload, query, today }: {
  folders: VisibleFolder[];
  isOpen: (unitId: string) => boolean;
  onToggle: (unitId: string, open: boolean) => void;
  onOpenDocument: (id: string) => void;
  onUpload: (unitId: string) => void;
  query: string;
  today: string;
}) {
  const rows: TreeRow[] = folders.flatMap((folder) => {
    const open = isOpen(folder.unitId);
    const self: TreeRow = { id: folder.unitId, kind: "folder", parentId: null, expanded: open, hasChildren: folder.shown.length > 0 };
    return open ? [self, ...folder.shown.map((doc) => ({ id: doc.id, kind: "doc" as const, parentId: folder.unitId }))] : [self];
  });
  const { itemProps } = useTreeKeyboard({
    rows,
    onToggle,
    onActivate: (item) => (item.kind === "folder" ? onToggle(item.id, !item.expanded) : onOpenDocument(item.id)),
  });
  const rowById = new Map(rows.map((item) => [item.id, item]));

  return <ul role="tree" aria-label="Unit documents" className="grid gap-0.5">
    {folders.map((folder, index) => {
      const open = isOpen(folder.unitId);
      const self = rowById.get(folder.unitId)!;
      return <li key={folder.unitId} role="treeitem" aria-selected={false} aria-expanded={open} aria-level={1} aria-setsize={folders.length} aria-posinset={index + 1}
        aria-label={`${folder.unitName}, ${folder.count} ${folder.count === 1 ? "document" : "documents"}`} {...itemProps(self)}
        className="outline-none [&:focus-visible>div:first-child]:ring-2 [&:focus-visible>div:first-child]:ring-brand"
        onClick={(event) => { if (event.target === event.currentTarget || (event.target as HTMLElement).closest("[data-folder-row]")) onToggle(folder.unitId, !open); }}>
        <div data-folder-row className={row}>
          {open ? <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-muted" /> : <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-muted" />}
          {open ? <FolderOpen aria-hidden="true" size={18} className="shrink-0 text-brand-dark" /> : <Folder aria-hidden="true" size={18} className="shrink-0 text-brand-dark" />}
          <span className="min-w-0 flex-1 truncate font-semibold text-ink"><Highlight text={folder.unitName} query={query} /></span>
          {folder.expiredCount ? <span className="shrink-0 rounded-sm bg-danger-soft px-1.5 text-label font-bold text-danger">{folder.expiredCount} expired</span> : null}
          {folder.dueCount ? <span className="shrink-0 rounded-sm bg-warn-soft px-1.5 text-label font-bold text-warn">{folder.dueCount} due</span> : null}
          <span className="w-6 shrink-0 text-right font-data text-body-sm text-muted">{folder.count}</span>
        </div>
        {open ? <ul role="group" className="ml-4 border-l border-rule pl-2">
          {folder.shown.length === 0
            ? <li role="none" className="px-2 py-2 text-body-sm text-muted">Empty. Add or <button type="button" className="font-semibold text-brand-dark underline underline-offset-2" onClick={(event) => { event.stopPropagation(); onUpload(folder.unitId); }}>upload a document</button>.</li>
            : folder.shown.map((doc, docIndex) => {
              const Icon = isPdf(doc.mimeType) ? FileText : FileImage;
              const type = documentTypeLabels[doc.documentType] ?? doc.documentType;
              return <li key={doc.id} role="treeitem" aria-selected={false} aria-level={2} aria-setsize={folder.shown.length} aria-posinset={docIndex + 1} aria-label={`${type}, expires ${doc.expiresOn}`}
                {...itemProps(rowById.get(doc.id)!)} className={`${row} flex-col items-stretch gap-0.5`} onClick={(event) => { event.stopPropagation(); onOpenDocument(doc.id); }}>
                <span className="flex min-w-0 items-center gap-2">
                  <Icon aria-hidden="true" size={16} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink"><Highlight text={type} query={query} /></span>
                  <ExpiryStatus expiresOn={doc.expiresOn} today={today} />
                </span>
                <span className="pl-6 font-data text-body-sm text-muted">
                  <Highlight text={doc.documentNumber || "No number"} query={doc.documentNumber ? query : ""} /> · Expires <Highlight text={doc.expiresOn} query={query} />
                </span>
              </li>;
            })}
        </ul> : null}
      </li>;
    })}
  </ul>;
}
