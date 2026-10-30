import { formatPesos } from "@/lib/money/centavos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UnitIncomeBar } from "@/lib/dashboard/ordering";

/** Bar width comes from the data (0–100 %), so it is the one inline style here. */
function Bar({ pct, className, label }: { pct: number; className: string; label: string }) {
  return <div className="h-2 min-w-0 flex-1 rounded-sm bg-canvas" aria-hidden="true" title={label}><div className={`h-2 rounded-sm ${className}`} style={{ width: `${pct}%` }} /></div>;
}

/**
 * Collected vs expenses for each unit this month (US5, FR-023). Replaces the monthly unit summary
 * table, so every unit's exact amounts stay readable as text beside its bars (FR-024).
 */
export function UnitIncomeChart({ bars, monthLabel }: { bars: UnitIncomeBar[]; monthLabel: string }) {
  const hasData = bars.some((bar) => bar.collectedCentavos || bar.expenseCentavos);
  return <Card className="min-w-0">
    <CardHeader><CardTitle><h3 className="text-section-title font-bold">Collected vs expenses by unit</h3></CardTitle><p className="text-body-sm text-muted">{monthLabel}. Net income is collected minus expenses.</p></CardHeader>
    <CardContent>
      {hasData ? <>
        <p className="flex flex-wrap gap-4 text-label text-muted" aria-hidden="true"><span className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-brand" />Collected</span><span className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-brand-dark" />Expenses</span></p>
        <UnitRows bars={bars.slice(0, shownUnits)} />
        {bars.length > shownUnits ? <details className="mt-1"><summary className="touch-target flex cursor-pointer items-center text-body-sm font-semibold text-brand-dark underline underline-offset-4">Show all {bars.length} units</summary><UnitRows bars={bars.slice(shownUnits)} /></details> : null}
      </> : <p className="py-2 text-body-sm text-muted">No remittances or expenses recorded this month yet.</p>}
    </CardContent>
  </Card>;
}

/** Units listed before the rest fold into "Show all units". */
const shownUnits = 5;

function UnitRows({ bars }: { bars: UnitIncomeBar[] }) {
  return <ul className="mt-3 divide-y divide-rule">{bars.map((bar) => <li key={bar.unitId} className="grid gap-1 py-2">
          <div className="flex items-baseline justify-between gap-3"><span className="font-data text-body-sm font-semibold">Body {bar.bodyNumber}</span><span className={`font-data text-label font-semibold ${bar.netCentavos < 0 ? "text-danger" : "text-ok"}`}>Net {formatPesos(bar.netCentavos)}</span></div>
          <div className="flex items-center gap-3 text-label"><Bar pct={bar.collectedPct} className="bg-brand" label="Collected" /><span className="w-24 shrink-0 text-right font-data text-ink"><span className="sr-only">Collected </span>{formatPesos(bar.collectedCentavos)}</span></div>
          <div className="flex items-center gap-3 text-label"><Bar pct={bar.expensePct} className="bg-brand-dark" label="Expenses" /><span className="w-24 shrink-0 text-right font-data text-muted"><span className="sr-only">Expenses </span>{formatPesos(bar.expenseCentavos)}</span></div>
        </li>)}</ul>;
}
