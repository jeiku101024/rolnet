"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// Feature 013 (FR-003–FR-007, contracts/ui.md): a bordered pane with its own Filters, Upload,
// chips, search and summary. Filter choices apply at once and never touch the other pane.

const toolButton = "touch-target inline-flex shrink-0 items-center gap-2 rounded-md border border-control-border bg-surface px-3 text-body-sm font-semibold text-ink hover:bg-brand-soft aria-expanded:bg-brand-soft";
const chipButton = "touch-target inline-flex items-center gap-2 rounded-md border border-control-border bg-surface px-3 text-body-sm text-ink hover:bg-brand-soft";

export interface FilterGroup { key: string; label: string; options: { value: string; label: string }[]; chosen: string[] }

export function Pane({ title, count, uploadLabel, onUpload, filters, onFilterChange, onClearFilters, searchLabel, search, onSearch, summary, summaryActions, children }: {
  title: string;
  count: string;
  uploadLabel: string;
  onUpload: () => void;
  filters: FilterGroup[];
  onFilterChange: (key: string, values: string[]) => void;
  onClearFilters: () => void;
  searchLabel: string;
  search: string;
  onSearch: (value: string) => void;
  summary: string | null;
  summaryActions?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const chosenCount = filters.reduce((sum, group) => sum + group.chosen.length, 0);
  const chips = filters.flatMap((group) => group.chosen.map((value) => ({ group, value, text: `${group.label}: ${group.options.find((option) => option.value === value)?.label ?? value}` })));

  return <section aria-labelledby={`${id}-title`} className="grid min-w-0 content-start gap-3 rounded-md border border-rule bg-surface p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 id={`${id}-title`} className="text-section-title font-bold">{title}</h2>
        <p className="text-body-sm text-muted">{count}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" className={toolButton} aria-expanded={open} aria-controls={`${id}-filters`} aria-label={chosenCount ? `Filters (${chosenCount} on)` : "Filters"} onClick={() => setOpen(!open)}>
          <SlidersHorizontal aria-hidden="true" size={16} />Filters
          {chosenCount ? <span className="rounded-sm bg-brand-soft px-1.5 font-data text-label font-bold text-brand-dark">{chosenCount}</span> : null}
        </button>
        <Button type="button" aria-label={uploadLabel} onClick={onUpload}><Plus aria-hidden="true" size={16} />Upload</Button>
      </div>
    </div>

    {open ? <div id={`${id}-filters`} className="grid gap-4 rounded-md border border-rule bg-canvas p-3 sm:grid-cols-2">
      {filters.map((group) => <fieldset key={group.key} className="grid gap-2">
        <legend className="mb-1 text-label font-bold text-muted">{group.label}</legend>
        {group.options.map((option) => <label key={option.value} className="flex min-h-11 items-center gap-3 text-body-sm text-ink">
          <Checkbox checked={group.chosen.includes(option.value)} onCheckedChange={(checked) => onFilterChange(group.key, checked ? [...group.chosen, option.value] : group.chosen.filter((value) => value !== option.value))} />
          {option.label}
        </label>)}
      </fieldset>)}
    </div> : null}

    {chips.length ? <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => <button key={`${chip.group.key}:${chip.value}`} type="button" className={chipButton} aria-label={`Remove filter ${chip.text}`} onClick={() => onFilterChange(chip.group.key, chip.group.chosen.filter((value) => value !== chip.value))}>
        {chip.text}<X aria-hidden="true" size={14} />
      </button>)}
      <button type="button" className="touch-target px-2 text-body-sm font-semibold text-brand-dark underline underline-offset-2" onClick={onClearFilters}>Clear all</button>
    </div> : null}

    <label className="relative block">
      <span className="sr-only">{searchLabel}</span>
      <Search aria-hidden="true" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input type="search" value={search} placeholder={searchLabel} onChange={(event) => onSearch(event.target.value)}
        className="touch-target w-full min-w-0 rounded-md border border-control-border bg-surface pr-3 pl-9 text-body-sm text-ink" />
    </label>

    {summary || summaryActions ? <div className="flex min-h-11 items-center justify-between gap-2">
      <p className="text-body-sm text-muted" role="status">{summary}</p>
      {summaryActions ? <div className="flex shrink-0 gap-1">{summaryActions}</div> : null}
    </div> : null}

    {children}
  </section>;
}
