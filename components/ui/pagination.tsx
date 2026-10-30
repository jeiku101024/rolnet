import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { listHref, type ListPageState, type SearchParams } from "@/lib/pagination/list-page";

const control = "touch-target inline-flex min-w-11 items-center justify-center gap-1 rounded-md border border-rule px-2 text-body-sm font-semibold";

function Step({ href, label, icon, scroll }: { href: string | null; label: string; icon: React.ReactNode; scroll: boolean }) {
  if (!href) return <span className={`${control} text-subtle`} aria-disabled="true">{icon}<span className="sr-only">{label}</span></span>;
  return <Link className={`${control} bg-surface text-ink hover:bg-brand-soft`} href={href} scroll={scroll} aria-label={label}>{icon}</Link>;
}

/** First / Previous / Page x of y / Next / Last for one list (contracts/list-paging.md). Hidden for a single page. */
export function Pagination({ pathname, searchParams, prefix = "", state }: { pathname: string; searchParams: SearchParams; prefix?: string; state: ListPageState }) {
  if (state.lastPage <= 1) return null;
  const param = `${prefix}page`;
  const to = (page: number) => listHref(pathname, searchParams, { [param]: page });
  const scroll = prefix === "";
  const { page, lastPage } = state;
  return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 pt-4">
    <p className="font-data text-label text-muted">{state.rangeLabel}</p>
    <div className="flex items-center gap-1">
      <Step href={page > 1 ? to(1) : null} label="First page" icon={<ChevronsLeft aria-hidden="true" size={16} />} scroll={scroll} />
      <Step href={page > 1 ? to(page - 1) : null} label="Previous page" icon={<ChevronLeft aria-hidden="true" size={16} />} scroll={scroll} />
      <span className="px-2 text-body-sm font-semibold text-ink" aria-current="page">Page {page} of {lastPage}</span>
      <Step href={page < lastPage ? to(page + 1) : null} label="Next page" icon={<ChevronRight aria-hidden="true" size={16} />} scroll={scroll} />
      <Step href={page < lastPage ? to(lastPage) : null} label="Last page" icon={<ChevronsRight aria-hidden="true" size={16} />} scroll={scroll} />
    </div>
  </nav>;
}
