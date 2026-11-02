"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The profile's history tabs (feature 012, FR-020): links in a tab list, one panel at a time. Arrow
 * keys, Home, and End move between tabs (roving focus) and open the focused tab.
 */
export function ProfileTabs({ tabs, active, children, loadMoreHref }: {
  tabs: { value: string; label: string; href: string }[];
  active: string;
  children: ReactNode;
  /** Shown while more rows exist (FR-021). */
  loadMoreHref?: string;
}) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.value === active);
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
        : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    (listRef.current?.querySelectorAll<HTMLElement>("[role=tab]")[next])?.focus();
    router.push(tabs[next].href, { scroll: false });
  }

  return <div className="grid min-w-0 gap-3">
    <div ref={listRef} role="tablist" aria-label="Driver history" onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b border-rule">
      {tabs.map((tab) => {
        const selected = tab.value === active;
        return <Link key={tab.value} id={`tab-${tab.value}`} role="tab" aria-selected={selected} aria-controls="driver-tab-panel" tabIndex={selected ? 0 : -1} href={tab.href} scroll={false}
          className={cn("touch-target inline-flex shrink-0 items-center border-b-2 px-3 text-body-sm font-semibold whitespace-nowrap", selected ? "border-brand-dark text-ink" : "border-transparent text-muted hover:text-ink")}>
          {tab.label}
        </Link>;
      })}
    </div>
    <div id="driver-tab-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="min-w-0">
      {children}
      {loadMoreHref ? <div className="mt-3 flex justify-center"><Link href={loadMoreHref} scroll={false} className="touch-target inline-flex items-center rounded-md border border-control-border px-4 text-body-sm font-semibold text-ink hover:bg-brand-soft">Load more</Link></div> : null}
    </div>
  </div>;
}
