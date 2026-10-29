"use client";

import { useEffect, useRef, useState } from "react";

/** A row's searchable text. A select contributes only its chosen option, not every option label. */
function rowText(row: Element) {
  let text = row.textContent ?? "";
  row.querySelectorAll("select").forEach((select) => {
    const options = Array.from(select.options).map((option) => option.textContent ?? "").join("");
    text = text.replace(options, select.selectedOptions[0]?.textContent ?? "");
  });
  return text.toLowerCase();
}

export function TableSearch({ tableId, placeholder = "Search records" }: { tableId?: string; placeholder?: string }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const table = tableId ? document.getElementById(tableId) : inputRef.current?.closest(".data-region")?.querySelector("table");
    if (!table) return;
    const needle = value.trim().toLowerCase();
    table.querySelectorAll("tbody tr").forEach((row) => {
      const matches = !needle || rowText(row).includes(needle);
      row.toggleAttribute("hidden", !matches);
    });
  }, [tableId, value]);

  return <label className="relative min-w-56 text-body-sm"><span className="sr-only">{placeholder}</span><input ref={inputRef} className="touch-target w-full rounded-md border border-rule bg-surface px-3 pr-8 text-body-sm text-ink placeholder:text-muted" value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} type="search" />{value ? <button className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-label font-semibold text-muted" type="button" onClick={() => setValue("")} aria-label="Clear search">Clear</button> : null}</label>;
}
