import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="workspace-header"><div><p className="text-label font-bold uppercase tracking-[0.08em] text-brand-dark">{eyebrow ?? "ROLNET Fleet Ledger"}</p><h1 className="mt-2 text-page-title font-bold leading-tight text-ink">{title}</h1>{description ? <p className="mt-2 max-w-2xl text-body-sm text-muted">{description}</p> : null}</div>{action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}</header>;
}

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="section-heading"><div><h2 className="text-section-title font-bold text-ink">{title}</h2>{description ? <p className="mt-1 text-body-sm text-muted">{description}</p> : null}</div>{action}</div>;
}
