import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { panelLimit } from "@/lib/dashboard/ordering";

/** Rows a phone shows before "View all" takes over (`.panel-rows` in app/globals.css). */
export const phoneRowLimit = 3;

/**
 * One dashboard panel (contracts/dashboard.md): the most urgent rows (3 on phones, up to 5 from
 * tablet width), a "View all N" link when there are more, and a plain message when there are none.
 */
export function DashboardPanel({ title, description, total, href, empty, children, id }: { title: string; description?: string; total: number; href: string; empty: string; children: ReactNode; id?: string }) {
  const moreClass = total > panelLimit ? "inline-flex" : total > phoneRowLimit ? "panel-more-phone" : "hidden";
  return <Card className="min-w-0" aria-labelledby={id}>
    <CardHeader><CardTitle><h3 id={id} className="text-section-title font-bold">{title}</h3></CardTitle>{description ? <p className="text-body-sm text-muted max-md:sr-only">{description}</p> : null}{total > 0 ? <CardAction><span className="font-data text-label text-muted">{total}</span></CardAction> : null}</CardHeader>
    <CardContent>{total ? <ul className="panel-rows divide-y divide-rule">{children}</ul> : <p className="py-2 text-body-sm text-muted">{empty}</p>}
      <Link className={`${moreClass} mt-2 min-h-11 items-center gap-1 text-body-sm font-semibold text-brand-dark underline underline-offset-4`} href={href}>View all {total} <ArrowUpRight aria-hidden="true" size={14} /></Link>
    </CardContent>
  </Card>;
}

/** A panel row: main text and detail on the left, a status or amount on the right. */
export function PanelRow({ href, title, detail, aside }: { href?: string; title: ReactNode; detail?: ReactNode; aside?: ReactNode }) {
  return <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
    <div className="min-w-0">{href ? <Link className="muted-link font-semibold" href={href}>{title}</Link> : <p className="font-semibold">{title}</p>}{detail ? <p className="text-body-sm text-muted">{detail}</p> : null}</div>
    {aside ? <div className="shrink-0 text-right">{aside}</div> : null}
  </li>;
}
