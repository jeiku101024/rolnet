import Link from "next/link";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { listHref, type ListPageState, type SearchParams } from "@/lib/pagination/list-page";
import { ListSearch } from "@/components/ui/list-search";
import { Pagination } from "@/components/ui/pagination";
import { Card, CardContent } from "@/components/ui/card";

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
  /** Fixed filters shown as removable notes, e.g. "Showing units in repair". */
  filters?: { label: string; param: string }[];
}

export function listView(pathname: string, searchParams: SearchParams, request: { prefix: string; q: string }, state: ListPageState, options: Pick<ListView, "search" | "searchLabel" | "filters"> = {}): ListView {
  return { pathname, searchParams, prefix: request.prefix, q: request.q, state, ...options };
}

export function ListToolbar({ list }: { list: ListView }) {
  const prefix = list.prefix ?? "";
  const { total } = list.state;
  return <div className="flex flex-col gap-3 border-b border-rule pt-2 pb-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      {list.search === false ? null : <ListSearch key={list.q} pathname={list.pathname} searchParams={list.searchParams} prefix={prefix} initialValue={list.q} label={list.searchLabel} placeholder={list.searchLabel ? `${list.searchLabel}…` : undefined} />}
      <span className="font-data text-label text-muted">{total} {total === 1 ? "record" : "records"}</span>
    </div>
    {list.filters?.length ? <div className="flex flex-wrap gap-2">{list.filters.map((filter) => <Link key={filter.param} className="touch-target inline-flex items-center gap-1 rounded-md bg-brand-soft px-3 text-label font-semibold text-brand-dark" href={listHref(list.pathname, list.searchParams, { [filter.param]: null, [`${prefix}page`]: null })} aria-label={`${filter.label}. Remove this filter`}>{filter.label}<X aria-hidden="true" size={14} /></Link>)}</div> : null}
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
  const narrowed = Boolean(list.q) || Boolean(list.filters?.length);
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
