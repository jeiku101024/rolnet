import { formatPesos } from "@/lib/money/centavos";
import type { UnitIncomeBar } from "@/lib/dashboard/ordering";

/** Units listed on the card before the rest move into the "Show all units" dialog. */
export const shownUnits = 5;

/** Bar width comes from the data (0–100 %), so it is the one inline style here. */
function Bar({ pct, className, label }: { pct: number; className: string; label: string }) {
  return <div className="h-2 min-w-0 flex-1 rounded-sm bg-canvas" aria-hidden="true" title={label}><div className={`h-2 rounded-sm ${className}`} style={{ width: `${pct}%` }} /></div>;
}

/** Collected and expenses bars with exact amounts as text, one row per unit (card and dialog share it). */
export function UnitRows({ bars }: { bars: UnitIncomeBar[] }) {
  return <ul className="mt-3 divide-y divide-rule">{bars.map((bar) => <li key={bar.unitId} className="grid gap-1 py-2">
          <div className="flex items-baseline justify-between gap-3"><span className="font-data text-body-sm font-semibold">Body {bar.bodyNumber}</span><span className={`font-data text-label font-semibold ${bar.netCentavos < 0 ? "text-danger" : "text-ok"}`}>Net {formatPesos(bar.netCentavos)}</span></div>
          <div className="flex items-center gap-3 text-label"><Bar pct={bar.collectedPct} className="bg-brand" label="Collected" /><span className="w-24 shrink-0 text-right font-data text-ink"><span className="sr-only">Collected </span>{formatPesos(bar.collectedCentavos)}</span></div>
          <div className="flex items-center gap-3 text-label"><Bar pct={bar.expensePct} className="bg-brand-dark" label="Expenses" /><span className="w-24 shrink-0 text-right font-data text-muted"><span className="sr-only">Expenses </span>{formatPesos(bar.expenseCentavos)}</span></div>
        </li>)}</ul>;
}
