"use client";

import { useId, useState, useTransition, type ReactNode, type SelectHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { listHref, type SearchParams } from "@/lib/pagination/list-page";
import type { ListControlsView } from "@/lib/pagination/list-controls";
import { datePresets, matchingPreset, rangeText } from "@/lib/pagination/date-presets";

const field = "touch-target w-full min-w-0 rounded-md border border-rule bg-surface px-3 text-body-sm text-ink";
const toolButton = "touch-target inline-flex shrink-0 items-center gap-2 rounded-md border border-rule bg-surface px-3 text-body-sm font-semibold text-ink hover:bg-brand-soft aria-expanded:bg-brand-soft aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-brand-dark";

const chipButton = "touch-target inline-flex items-center gap-2 rounded-md border border-rule bg-surface px-3 text-body-sm text-ink hover:bg-brand-soft";

/** A native select with its arrow drawn inside the field, clear of the edge. */
export function FilterSelect({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className={`relative block min-w-0 ${className}`}>
    <select {...props} className={`${field} appearance-none truncate pr-9`} />
    <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
  </span>;
}

function useListNavigation(pathname: string, searchParams: SearchParams) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Every change drops the page, so results restart at page 1.
  const go = (changes: Record<string, string | null>) => startTransition(() => router.replace(listHref(pathname, searchParams, { ...changes, page: null }), { scroll: false }));
  return { go, pending };
}

/**
 * Search, date and filter controls of a main list (feature 006, User Story 8), laid out like the
 * remittances redesign: one row with the search box, a date button and a Filters button; quick
 * date choices and the filter panel open under it; the filters that are on show as removable chips.
 * Dates apply at once; the filter panel applies its choices together with "Apply filters".
 */
export function ListControls({ pathname, searchParams, controls, search }: { pathname: string; searchParams: SearchParams; controls: ListControlsView; search: ReactNode }) {
  const { go, pending } = useListNavigation(pathname, searchParams);
  const id = useId();
  const range = controls.spec.filters.find((def) => def.kind === "range");
  const selects = controls.spec.filters.filter((def) => def.kind !== "range");
  const { from, to } = controls.values;
  const preset = matchingPreset(from, to, controls.today);
  const [open, setOpen] = useState<"dates" | "filters" | null>(null);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const selectCount = selects.filter((def) => controls.values[def.param]).length;
  const showCustom = custom || Boolean((from || to) && !preset);
  const dateText = rangeText(from, to, controls.today);

  function toggle(panel: "dates" | "filters") {
    if (panel === "filters" && open !== "filters") setDraft(Object.fromEntries(selects.map((def) => [def.param, controls.values[def.param] ?? ""])));
    setOpen(open === panel ? null : panel);
  }
  function applyFilters() {
    go(Object.fromEntries(selects.map((def) => [def.param, draft[def.param] || null])));
    setOpen(null);
  }
  // The date button shows and clears the date range; the chips and "Clear all" cover the other filters.
  function clearAll() { go(Object.fromEntries(selects.map((def) => [def.param, null]))); }

  const chips: { key: string; text: string; clear: Record<string, null> }[] = [];
  for (const def of selects) {
    const value = controls.values[def.param];
    const option = value ? def.options.find((item) => item.value === value) : undefined;
    if (option) chips.push({ key: def.param, text: `${def.label}: ${option.label}`, clear: { [def.param]: null } });
  }
  const updating = pending ? <span className="text-label text-muted" role="status">Updating…</span> : null;

  return <div className="grid gap-3" aria-busy={pending}>
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-64">{search}</div>
      {range ? <button type="button" className={toolButton} aria-expanded={open === "dates"} aria-controls={`${id}-dates`} aria-label={`${range.label}: ${dateText}`} onClick={() => toggle("dates")}>
        <CalendarDays aria-hidden="true" size={16} /><span>{dateText}</span><ChevronDown aria-hidden="true" size={16} className={open === "dates" ? "rotate-180" : undefined} />
      </button> : null}
      {selects.length ? <button type="button" className={toolButton} aria-expanded={open === "filters"} aria-controls={`${id}-filters`} aria-label={selectCount ? `Filters (${selectCount} on)` : "Filters"} onClick={() => toggle("filters")}>
        <SlidersHorizontal aria-hidden="true" size={16} />Filters
        {selectCount ? <span className="rounded-sm bg-brand-soft px-1.5 font-data text-label font-bold text-brand-dark">{selectCount}</span> : null}
      </button> : null}
    </div>

    {range && open === "dates" ? <div id={`${id}-dates`} role="group" aria-label={range.label} className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={toolButton} aria-pressed={!from && !to && !custom} onClick={() => { setCustom(false); go({ from: null, to: null }); }}>Any date</button>
        {datePresets(controls.today).map((item) => <button key={item.value} type="button" className={toolButton} aria-pressed={!custom && preset?.value === item.value} onClick={() => { setCustom(false); go({ from: item.from, to: item.to }); }}>{item.label}</button>)}
        <button type="button" className={toolButton} aria-pressed={showCustom} onClick={() => setCustom(true)}>Custom…</button>
      </div>
      {showCustom ? <div className="grid grid-cols-2 gap-2 sm:flex">
        <div className="grid min-w-0 gap-1 sm:w-44"><label className="text-label font-bold text-muted" htmlFor={`${id}-from`}>From</label><input id={`${id}-from`} className={field} type="date" value={from ?? ""} max={to} onChange={(event) => go({ from: event.target.value || null })} /></div>
        <div className="grid min-w-0 gap-1 sm:w-44"><label className="text-label font-bold text-muted" htmlFor={`${id}-to`}>To</label><input id={`${id}-to`} className={field} type="date" value={to ?? ""} min={from} onChange={(event) => go({ to: event.target.value || null })} /></div>
      </div> : null}
    </div> : null}

    {selects.length && open === "filters" ? <div id={`${id}-filters`} role="group" aria-label="Filters" className="grid gap-3 rounded-md border border-rule bg-canvas p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {selects.map((def) => <div key={def.param} className="grid min-w-0 gap-1"><label className="text-label font-bold text-muted" htmlFor={`${id}-${def.param}`}>{def.label}</label>
          <FilterSelect id={`${id}-${def.param}`} value={draft[def.param] ?? ""} onChange={(event) => setDraft({ ...draft, [def.param]: event.target.value })}>
            <option value="">All</option>
            {def.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </FilterSelect>
        </div>)}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={toolButton} onClick={() => setOpen(null)}>Cancel</button>
        <button type="button" className="touch-target inline-flex items-center rounded-md bg-brand px-4 text-body-sm font-semibold text-surface hover:bg-brand-dark" onClick={applyFilters}>Apply filters</button>
      </div>
    </div> : null}

    {chips.length ? <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => <button key={chip.key} type="button" className={chipButton} aria-label={`Remove filter ${chip.text}`} onClick={() => go(chip.clear)}>{chip.text}<X aria-hidden="true" size={14} /></button>)}
      <button type="button" className="touch-target px-2 text-body-sm text-muted underline hover:text-ink" onClick={clearAll}>Clear all</button>
      {updating}
    </div> : updating}
  </div>;
}

/** The sort choice, beside the record count above the rows. */
export function ListSort({ pathname, searchParams, controls }: { pathname: string; searchParams: SearchParams; controls: ListControlsView }) {
  const { go } = useListNavigation(pathname, searchParams);
  const id = useId();
  const defaultSort = controls.spec.sorts[0]?.value;
  return <div className="flex min-w-0 items-center gap-2">
    <label className="shrink-0 text-label font-bold text-muted" htmlFor={id}>Sort</label>
    <FilterSelect id={id} className="w-52 max-w-full" value={controls.sort} onChange={(event) => go({ sort: event.target.value === defaultSort ? null : event.target.value })}>
      {controls.spec.sorts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </FilterSelect>
  </div>;
}
