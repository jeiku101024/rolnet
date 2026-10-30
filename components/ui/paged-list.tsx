import Link from "next/link";
import type { ReactNode } from "react";
import { listHref, type ListPageState, type SearchParams } from "@/lib/pagination/list-page";
import { ListSearch } from "@/components/ui/list-search";
import { Pagination } from "@/components/ui/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { ListControls, ListSort } from "@/components/ui/list-controls";
import type { ListControlsView } from "@/lib/pagination/list-controls";

/** Everything a paged list needs to draw its toolbar and footer (contracts/list-paging.md). */
export interface ListView {
  pathname: string;
  searchParams: SearchParams;
  prefix?: string;
  q: string;
  state: ListPageState;
  /** `false` for lists without a search box (days off, mileage readings). */
  search?: boolean;
  searchLabel?: string;
  /** Sort and filter controls of a main list (User Story 8). */
  controls?: ListControlsView;
  /** A short tip shown after the record count, e.g. what opening a row does. */
  hint?: string;
}

export function listView(pathname: string, searchParams: SearchParams, request: { prefix: string; q: string }, state: ListPageState, options: Pick<ListView, "search" | "searchLabel" | "controls" | "hint"> = {}): ListView {
  return { pathname, searchParams, prefix: request.prefix, q: request.q, state, ...options };
}

export function ListToolbar({ list }: { list: ListView }) {
  const prefix = list.prefix ?? "";
  const { total } = list.state;
  const count = <span className="font-data text-label text-muted">{total} {total === 1 ? "record" : "records"}{list.hint ? <span className="font-sans"> · {list.hint}</span> : null}</span>;
  const search = list.search === false ? null : <ListSearch pathname={list.pathname} searchParams={list.searchParams} prefix={prefix} initialValue={list.q} label={list.searchLabel} placeholder={list.searchLabel ? `${list.searchLabel}…` : undefined} wide={Boolean(list.controls)} />;
  // Main lists (User Story 8): search, dates and filters on top; the count and sort just above the rows.
  if (list.controls) return <div className="flex flex-col gap-3 border-b border-rule pt-2 pb-3">
    <ListControls pathname={list.pathname} searchParams={list.searchParams} controls={list.controls} search={search} />
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">{count}<ListSort pathname={list.pathname} searchParams={list.searchParams} controls={list.controls} /></div>
  </div>;
  return <div className="flex flex-col gap-3 border-b border-rule pt-2 pb-4">
    <div className="flex flex-wrap items-center justify-between gap-3">{search}{count}</div>
  </div>;
}

/** Shown instead of rows when a search or filter matches nothing. */
export function SearchEmpty({ list }: { list: ListView }) {
  const prefix = list.prefix ?? "";
  const clear = listHref(list.pathname, list.searchParams, { [`${prefix}q`]: null });
  return <div className="px-4 py-8 text-center"><p className="font-semibold text-ink">{list.q ? `No records match "${list.q}".` : "No records match this filter."}</p>{list.q ? <Link className="muted-link mt-3 inline-block text-body-sm" href={clear} scroll={prefix === ""}>Clear search</Link> : null}</div>;
}

/** Toolbar, rows (or the right empty message) and pagination footer, shared by tables and lists. */
export function ListFrame({ list, hasRows, empty, children }: { list: ListView; hasRows: boolean; empty?: ReactNode; children: ReactNode }) {
  const narrowed = Boolean(list.q) || Boolean(list.controls?.count);
  return <>
    <ListToolbar list={list} />
    <div className="pt-2">{hasRows ? children : narrowed ? <SearchEmpty list={list} /> : empty}</div>
    <Pagination pathname={list.pathname} searchParams={list.searchParams} prefix={list.prefix} state={list.state} />
  </>;
}

/** A paged `<ul>`-style list (documents, parts, tire history, mileage, payments, audit) in a card. */
export function PagedList({ list, hasRows, empty, children, bare = false }: { list: ListView; hasRows: boolean; empty?: ReactNode; children: ReactNode; bare?: boolean }) {
  const frame = <ListFrame list={list} hasRows={hasRows} empty={empty}>{children}</ListFrame>;
  return bare ? <div className="min-w-0">{frame}</div> : <Card className="min-w-0"><CardContent>{frame}</CardContent></Card>;
}
