import Link from "next/link";
import { formatPesos } from "@/lib/money/centavos";
import type { FleetStats as Stats } from "@/lib/dashboard/ordering";

function Tile({ label, value, detail, href, tone = "text-ink" }: { label: string; value: string; detail?: string; href?: string; tone?: string }) {
  const body = <><p className="text-label font-bold text-muted">{label}</p><p className={`mt-1 font-data text-section-title font-bold ${tone}`}>{value}</p>{detail ? <p className="mt-1 text-label text-muted">{detail}</p> : null}</>;
  return <li className="min-w-0 rounded-md border border-rule bg-surface p-3">{href ? <Link className="block hover:underline" href={href}>{body}</Link> : body}</li>;
}

/** This month's headline figures (US5, FR-021). Money comes summed in centavos; only formatted here. */
export function FleetStats({ stats, monthLabel }: { stats: Stats; monthLabel: string }) {
  return <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label={`Fleet figures for ${monthLabel}`}>
    <Tile label="Collected" value={formatPesos(stats.collectedCentavos)} />
    <Tile label="Expenses" value={formatPesos(stats.expenseCentavos)} />
    <Tile label="Net income" value={formatPesos(stats.netCentavos)} detail={stats.netCentavos < 0 ? "Spent more than collected" : "Collected minus expenses"} tone={stats.netCentavos < 0 ? "text-danger" : "text-ok"} />
    <Tile label="Units on the road" value={`${stats.unitsActive}`} detail={`${stats.unitsInRepair} in repair`} href="/units" />
    <Tile label="Documents due" value={`${stats.documentsDue}`} detail="Expired or within 30 days" href="/documents?expiry=due" tone={stats.documentsDue ? "text-warn" : "text-ink"} />
    <Tile label="Maintenance due" value={`${stats.maintenanceDue}`} detail="Parts and tires" href="/maintenance?due=1" tone={stats.maintenanceDue ? "text-warn" : "text-ink"} />
  </ul>;
}
