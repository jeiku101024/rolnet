"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { listHref, type SearchParams } from "@/lib/pagination/list-page";

/** Pause after the last keystroke before the list is searched. */
const typingPause = 400;

/**
 * Whole-list search (feature 006). Writes `${prefix}q` to the URL after a short pause, which drops
 * the list's page so results start on page 1; the server then reads every matching record.
 * The same input stays mounted while results load, so focus and the text being typed are never lost.
 */
export function ListSearch({ pathname, searchParams, prefix = "", initialValue, placeholder = "Search records", label, wide = false }: { pathname: string; searchParams: SearchParams; prefix?: string; initialValue: string; placeholder?: string; label?: string; wide?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const sent = useRef(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const param = `${prefix}q`;

  function send(next: string) {
    const trimmed = next.trim();
    if (trimmed === sent.current) return;
    sent.current = trimmed;
    startTransition(() => router.replace(listHref(pathname, searchParams, { [param]: trimmed || null }), { scroll: false }));
  }

  // Text typed before the page finished loading is kept rather than overwritten.
  useEffect(() => {
    const typed = inputRef.current?.value ?? "";
    if (typed !== initialValue) setValue(typed);
    // Only on mount: later URL changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The URL's search changed from outside this box (Back, a "Clear search" link): show it.
  // Our own searches come back as the value already sent, and are ignored so typing is not reset.
  useEffect(() => {
    if (initialValue === sent.current) return;
    sent.current = initialValue;
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timer = setTimeout(() => send(value), typingPause);
    return () => clearTimeout(timer);
  });

  return <label className={`relative block w-full min-w-0 text-body-sm ${wide ? "" : "sm:max-w-sm"}`}>
    <span className="sr-only">{label ?? placeholder}</span>
    <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
    <input ref={inputRef} className="touch-target w-full rounded-md border border-rule bg-surface pl-9 pr-28 text-body-sm text-ink placeholder:text-muted" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); send(value); } }} placeholder={placeholder} type="search" aria-busy={pending} />
    <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
      {pending ? <span className="text-label text-muted" role="status">Searching…</span> : null}
      {value ? <button className="min-h-9 px-2 text-label font-semibold text-muted hover:text-ink" type="button" onClick={() => { setValue(""); send(""); inputRef.current?.focus(); }} aria-label="Clear search">Clear</button> : null}
    </span>
  </label>;
}
