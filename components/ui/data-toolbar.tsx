import type { ReactNode } from "react";

export function DataToolbar({ children, resultCount }: { children?: ReactNode; resultCount?: number }) {
  return <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule py-4"><div className="flex flex-1 flex-wrap items-end gap-3">{children}</div>{typeof resultCount === "number" ? <span className="font-data text-label text-muted">{resultCount} {resultCount === 1 ? "record" : "records"}</span> : null}</div>;
}

export function ToolbarField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-label font-bold text-muted"><span>{label}</span>{children}</label>;
}
