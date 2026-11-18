import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UnitIncomeDialog } from "@/components/dashboard/unit-income-dialog";
import { UnitRows, shownUnits } from "@/components/dashboard/unit-income-rows";
import type { UnitIncomeBar } from "@/lib/dashboard/ordering";

/**
 * Collected vs expenses for each unit this month (US5, FR-023). Replaces the monthly unit summary
 * table, so every unit's exact amounts stay readable as text beside its bars (FR-024). The card
 * lists the first units; "Show all" opens the rest in a pop-up so the card never changes height (feature 017).
 */
export function UnitIncomeChart({ bars, monthLabel }: { bars: UnitIncomeBar[]; monthLabel: string }) {
  const hasData = bars.some((bar) => bar.collectedCentavos || bar.expenseCentavos);
  return <Card className="h-full min-w-0">
    <CardHeader><CardTitle><h3 className="text-section-title font-bold">Collected vs expenses by unit</h3></CardTitle><p className="text-body-sm text-muted">{monthLabel}. Net income is collected minus expenses.</p></CardHeader>
    <CardContent>
      {hasData ? <>
        <p className="flex flex-wrap gap-4 text-label text-muted" aria-hidden="true"><span className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-brand" />Collected</span><span className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-brand-dark" />Expenses</span></p>
        <UnitRows bars={bars.slice(0, shownUnits)} />
        {bars.length > shownUnits ? <UnitIncomeDialog bars={bars} monthLabel={monthLabel} /> : null}
      </> : <p className="py-2 text-body-sm text-muted">No remittances or expenses recorded this month yet.</p>}
    </CardContent>
  </Card>;
}
