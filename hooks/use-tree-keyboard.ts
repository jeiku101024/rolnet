"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

// Feature 013 (FR-017, research R14, contracts/ui.md "Keyboard"): the WAI-ARIA tree pattern with
// one tab stop. Up/Down move between visible rows, Right expands a folder (or enters it), Left
// collapses it (or goes to the parent), Home/End jump, Enter/Space activate.

export interface TreeRow { id: string; kind: "folder" | "doc"; parentId: string | null; expanded?: boolean; hasChildren?: boolean }

export function useTreeKeyboard({ rows, onToggle, onActivate }: { rows: TreeRow[]; onToggle: (folderId: string, open: boolean) => void; onActivate: (row: TreeRow) => void }) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<string | null>(null);
  const activeId = focusedId && rows.some((row) => row.id === focusedId) ? focusedId : rows[0]?.id ?? null;

  useEffect(() => {
    if (pendingFocus.current) {
      refs.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });

  const move = useCallback((id: string | undefined) => {
    if (!id) return;
    setFocusedId(id);
    pendingFocus.current = id;
    refs.current.get(id)?.focus();
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>, row: TreeRow) => {
    const index = rows.findIndex((item) => item.id === row.id);
    const handled = () => { event.preventDefault(); event.stopPropagation(); };
    switch (event.key) {
      case "ArrowDown": handled(); move(rows[index + 1]?.id); break;
      case "ArrowUp": handled(); move(rows[index - 1]?.id); break;
      case "Home": handled(); move(rows[0]?.id); break;
      case "End": handled(); move(rows[rows.length - 1]?.id); break;
      case "ArrowRight":
        handled();
        if (row.kind === "folder") {
          if (!row.expanded) onToggle(row.id, true);
          else if (rows[index + 1]?.parentId === row.id) move(rows[index + 1].id);
        }
        break;
      case "ArrowLeft":
        handled();
        if (row.kind === "folder" && row.expanded) onToggle(row.id, false);
        else if (row.parentId) move(row.parentId);
        break;
      case "Enter":
      case " ":
        handled();
        onActivate(row);
        break;
    }
  }, [rows, move, onToggle, onActivate]);

  const itemProps = (row: TreeRow) => ({
    ref: (element: HTMLElement | null) => { if (element) refs.current.set(row.id, element); else refs.current.delete(row.id); },
    tabIndex: row.id === activeId ? 0 : -1,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, row),
    onFocus: () => setFocusedId(row.id),
  });

  return { itemProps };
}
