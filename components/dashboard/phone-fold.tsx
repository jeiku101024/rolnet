"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Folds a lower-priority dashboard section behind a "Show …" button on phones only (feature 006,
 * SC-004). From 48rem up the content is always shown and the button is hidden. It renders folded,
 * so phones never flash the content open while the page loads.
 */
export function PhoneFold({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div>
    <button type="button" className="touch-target flex w-full items-center justify-between gap-3 rounded-md border border-rule bg-surface px-3 text-left text-body-sm font-semibold text-ink md:hidden" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
      <span>{open ? `Hide ${label}` : `Show ${label}`}{hint && !open ? <span className="block text-label font-normal text-muted">{hint}</span> : null}</span>
      <ChevronDown aria-hidden="true" size={16} className={open ? "rotate-180" : undefined} />
    </button>
    <div id={id} className={open ? "mt-4 md:mt-0" : "max-md:hidden"}>{children}</div>
  </div>;
}
