"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

// Feature 013 follow-up: the unit pane shows 10 folders per page. Same look as the other lists'
// Pagination (components/ui/pagination.tsx), but with buttons, because the tree filters in the
// browser. Hidden when everything fits on one page.

const control = "touch-target inline-flex min-w-11 items-center justify-center gap-1 rounded-md border border-rule px-2 text-body-sm font-semibold";

function Step({ to, label, icon, onPage }: { to: number | null; label: string; icon: React.ReactNode; onPage: (page: number) => void }) {
  if (to === null) return <span className={`${control} text-subtle`} aria-disabled="true">{icon}<span className="sr-only">{label}</span></span>;
  return <button type="button" className={`${control} bg-surface text-ink hover:bg-brand-soft`} aria-label={label} onClick={() => onPage(to)}>{icon}</button>;
}

export function FolderPager({ page, lastPage, label, onPage }: { page: number; lastPage: number; label: string; onPage: (page: number) => void }) {
  if (lastPage <= 1) return null;
  return <nav aria-label="Folder pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3">
    <p className="font-data text-label text-muted">{label}</p>
    <div className="flex items-center gap-1">
      <Step to={page > 1 ? 1 : null} label="First page" icon={<ChevronsLeft aria-hidden="true" size={16} />} onPage={onPage} />
      <Step to={page > 1 ? page - 1 : null} label="Previous page" icon={<ChevronLeft aria-hidden="true" size={16} />} onPage={onPage} />
      <span className="px-2 text-body-sm font-semibold text-ink" aria-current="page">Page {page} of {lastPage}</span>
      <Step to={page < lastPage ? page + 1 : null} label="Next page" icon={<ChevronRight aria-hidden="true" size={16} />} onPage={onPage} />
      <Step to={page < lastPage ? lastPage : null} label="Last page" icon={<ChevronsRight aria-hidden="true" size={16} />} onPage={onPage} />
    </div>
  </nav>;
}
