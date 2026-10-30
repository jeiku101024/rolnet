"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { listHref, type SearchParams } from "@/lib/pagination/list-page";
import type { ListControlsView } from "@/lib/pagination/list-controls";

const field = "touch-target w-full min-w-0 rounded-md border border-rule bg-surface px-3 text-body-sm text-ink";

/**
 * Sort and filter for a main list (feature 006, User Story 8). Every change updates the URL at
 * once and drops the page, so results restart at page 1; the server applies it to every record.
 * Phones fold the controls behind one "Sort and filter" button; wider screens always show them.
 */
export function ListControls({ pathname, searchParams, controls }: { pathname: string; searchParams: SearchParams; controls: ListControlsView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const defaultSort = controls.spec.sorts[0]?.value;
  const changed = controls.count > 0 || controls.sort !== defaultSort;

  function go(changes: Record<string, string | null>) {
    startTransition(() => router.replace(listHref(pathname, searchParams, { ...changes, page: null }), { scroll: false }));
  }
  function clearAll() {
    const changes: Record<string, null> = { sort: null, from: null, to: null };
    for (const def of controls.spec.filters) if ("param" in def) changes[def.param] = null;
    go(changes);
  }

  const summary = controls.count ? `Sort and filter (${controls.count} on)` : "Sort and filter";
  return <div className="grid gap-3">
    <button type="button" className="touch-target flex w-full items-center justify-between gap-3 rounded-md border border-rule bg-surface px-3 text-left text-body-sm font-semibold text-ink md:hidden" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
      <span className="inline-flex items-center gap-2"><SlidersHorizontal aria-hidden="true" size={16} />{summary}</span>
      <ChevronDown aria-hidden="true" size={16} className={open ? "rotate-180" : undefined} />
    </button>
    <div id={id} role="group" aria-label="Sort and filter" className={`${open ? "grid" : "max-md:hidden md:grid"} gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4`} aria-busy={pending}>
      <div className="grid gap-1"><label className="text-label font-bold text-muted" htmlFor={`${id}-sort`}>Sort</label>
        <select id={`${id}-sort`} className={field} value={controls.sort} onChange={(event) => go({ sort: event.target.value === defaultSort ? null : event.target.value })}>
          {controls.spec.sorts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {controls.spec.filters.map((def) => def.kind === "range"
        ? <fieldset key="range" className="grid min-w-0 gap-1 sm:col-span-2"><legend className="mb-1 text-label font-bold text-muted">{def.label}</legend>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1"><label className="text-label text-muted" htmlFor={`${id}-from`}>From</label><input id={`${id}-from`} className={field} type="date" value={controls.values.from ?? ""} max={controls.values.to} onChange={(event) => go({ from: event.target.value || null })} /></div>
            <div className="grid gap-1"><label className="text-label text-muted" htmlFor={`${id}-to`}>To</label><input id={`${id}-to`} className={field} type="date" value={controls.values.to ?? ""} min={controls.values.from} onChange={(event) => go({ to: event.target.value || null })} /></div>
          </div>
        </fieldset>
        : <div key={def.param} className="grid gap-1"><label className="text-label font-bold text-muted" htmlFor={`${id}-${def.param}`}>{def.label}</label>
          <select id={`${id}-${def.param}`} className={field} value={controls.values[def.param] ?? ""} onChange={(event) => go({ [def.param]: event.target.value || null })}>
            <option value="">All</option>
            {def.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>)}
    </div>
    {changed ? <div className={`${open ? "flex" : "max-md:hidden md:flex"} flex-wrap items-center gap-3`}>
      <button type="button" className="touch-target inline-flex items-center gap-1 rounded-md border border-rule bg-surface px-3 text-body-sm font-semibold text-ink hover:bg-brand-soft" onClick={clearAll}><X aria-hidden="true" size={14} />Clear filters</button>
      {pending ? <span className="text-label text-muted" role="status">Updating…</span> : null}
    </div> : null}
  </div>;
}
