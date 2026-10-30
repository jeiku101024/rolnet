import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatPesos } from "@/lib/money/centavos";
import { documentTypeLabels } from "@/lib/validation/documents";
import { dispositionLabels } from "@/lib/pagination/search-specs";
import { StatusBadge } from "@/components/ui/feedback";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { PanelRow } from "@/components/dashboard/dashboard-panel";
import type { RecentKind } from "@/lib/dashboard/queries";

type Item = Record<string, unknown>;
const config: Record<RecentKind, { title: string; href: string; empty: string }> = {
  remittances: { title: "Recent remittances", href: "/remittances", empty: "No remittances recorded yet." },
  expenses: { title: "Recent expenses", href: "/expenses", empty: "No expenses recorded yet." },
  maintenance: { title: "Recent maintenance work", href: "/maintenance", empty: "No part or tire work recorded yet." },
  documents: { title: "Recently added documents", href: "/documents", empty: "No documents uploaded yet." },
};
/** The four history panels, in the order they appear (US6, FR-025). Units and drivers have their own pages. */
export const glimpseKinds: RecentKind[] = ["remittances", "expenses", "maintenance", "documents"];
export function getGlimpseConfig(kind: RecentKind) { return config[kind]; }
function text(value: unknown, fallback = "—") { return typeof value === "string" || typeof value === "number" ? String(value) : fallback; }
function nested(item: Item, key: string, field: string) { const value = item[key]; return Array.isArray(value) ? text((value[0] as Item | undefined)?.[field]) : value && typeof value === "object" ? text((value as Item)[field]) : "—"; }
function paidOf(item: Item) { const payments = item.remittance_payments; return Array.isArray(payments) ? payments.reduce((sum: number, payment) => sum + Number((payment as Item).amount_centavos ?? 0), 0) : 0; }

function Row({ kind, item }: { kind: RecentKind; item: Item }) {
  if (kind === "remittances") {
    const due = Number(item.amount_due_centavos ?? 0);
    const balance = due - paidOf(item);
    return <PanelRow href={`/remittances/${text(item.id)}`} title={<span className="font-data">{text(item.service_date)} · Body {nested(item, "units", "body_number")}</span>} detail={`${nested(item, "drivers", "full_name")}, ${dispositionLabels[text(item.disposition)] ?? text(item.disposition)}`} aside={<><p className="font-data text-data">{formatPesos(due)}</p>{balance > 0 ? <StatusBadge label={`${formatPesos(balance)} unpaid`} tone="warning" /> : <StatusBadge label="Paid" tone="success" />}</>} />;
  }
  if (kind === "expenses") return <PanelRow title={nested(item, "expense_categories", "name")} detail={<span className="font-data">{text(item.expense_date)} · Body {nested(item, "units", "body_number")}</span>} aside={<><p className="font-data text-data">{formatPesos(Number(item.amount_centavos ?? 0))}</p><StatusBadge label={item.receipt_object_path ? "Receipt attached" : "Receipt missing"} tone={item.receipt_object_path ? "success" : "warning"} /></>} />;
  if (kind === "maintenance") return <PanelRow href={`/maintenance/${text(item.unitId)}`} title={text(item.name)} detail={<span className="font-data">Body {text(item.bodyNumber)} · {text(item.date)}</span>} />;
  return <PanelRow href={`/documents/${text(item.id)}`} title={documentTypeLabels[text(item.document_type)] ?? text(item.document_type)} detail={`${text(item.holderLabel, "")} · expires ${text(item.expires_on)}`} />;
}

export function RecentDataGlimpse({ kind, items }: { kind: RecentKind; items: Item[] }) {
  const current = config[kind];
  return <Card className="min-w-0"><CardHeader><CardTitle><h3 className="text-section-title font-bold">{current.title}</h3></CardTitle><CardAction><Link className="inline-flex min-h-11 items-center gap-1 rounded-md border border-border px-3 text-label font-semibold hover:bg-accent" href={current.href}>View all <ArrowUpRight aria-hidden="true" size={14} /></Link></CardAction></CardHeader><CardContent>{items.length ? <ul className="panel-rows divide-y divide-rule">{items.slice(0, 5).map((item, index) => <Row key={text(item.id, `${kind}-${index}`)} kind={kind} item={item} />)}</ul> : <p className="py-2 text-body-sm text-muted">{current.empty}</p>}</CardContent></Card>;
}
