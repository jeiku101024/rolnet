"use client";

import { Fragment, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { finishListPage, listHref, pageSize, rangeFor } from "@/lib/pagination/list-page";
import { ListFrame, type ListView } from "@/components/ui/paged-list";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow } from "@/components/ui/table";

/** One row of a small list: its lowercase search text and the row markup the server already drew. */
export interface LocalRow { key: string; text: string; node: ReactNode }

/**
 * A record table for small lists (units, drivers: tens of rows). The server sends every row once;
 * search and paging then run here, so typing never waits on the network. The address is kept current
 * with `replaceState`. Sort and filters still go through the server, which re-sends the rows.
 */
export function LocalTable({ list, headers, rows, empty }: { list: ListView; headers: string[]; rows: LocalRow[]; empty?: ReactNode }) {
  const [q, setQ] = useState(list.q);
  const [page, setPage] = useState(list.state.page);
  const lastQ = useRef(list.q);

  const needle = q.trim().toLowerCase();
  const matching = useMemo(() => (needle ? rows.filter((row) => row.text.includes(needle)) : rows), [rows, needle]);
  const state = finishListPage(matching.length, page);
  const { from } = rangeFor(state.page);
  const shown = matching.slice(from, from + pageSize);

  // Sort and filter links read these, so they keep the text and page that are on screen.
  const trimmed = q.trim();
  const current: ListView = { ...list, q: trimmed, state, searchParams: { ...list.searchParams, q: trimmed || undefined, page: state.page > 1 ? String(state.page) : undefined } };

  // Stable, so the search box does not echo its text back on every render.
  const onType = useCallback((value: string) => {
    if (value !== lastQ.current) { lastQ.current = value; setPage(1); }
    setQ(value);
  }, []);
  const local = {
    onType,
    onClear() {
      onType("");
      const params = Object.fromEntries(new URLSearchParams(window.location.search));
      window.history.replaceState(null, "", listHref(list.pathname, params, { q: null }));
    },
    onPage(next: number) {
      setPage(next);
      const params = Object.fromEntries(new URLSearchParams(window.location.search));
      window.history.replaceState(null, "", listHref(list.pathname, params, { page: next }));
    },
  };

  return <Card className="min-w-0"><CardContent className="data-region border-0">
    <ListFrame list={current} hasRows={shown.length > 0} empty={empty} local={local}>
      <Table className="data-table"><TableHeader><TableRow>{headers.map((header) => <TableHead scope="col" key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{shown.map((row) => <Fragment key={row.key}>{row.node}</Fragment>)}</TableBody></Table>
    </ListFrame>
  </CardContent></Card>;
}
