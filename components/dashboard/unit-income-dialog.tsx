"use client";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { UnitRows } from "@/components/dashboard/unit-income-rows";
import type { UnitIncomeBar } from "@/lib/dashboard/ordering";

/**
 * "Show all N units" as a pop-up (feature 017). The full list arrives with the page, so opening and
 * closing is client state only: nothing is fetched and the dashboard behind it never moves.
 */
export function UnitIncomeDialog({ bars, monthLabel }: { bars: UnitIncomeBar[]; monthLabel: string }) {
  return <Dialog>
    <DialogTrigger className="touch-target mt-1 flex cursor-pointer items-center text-body-sm font-semibold text-brand-dark underline underline-offset-4">Show all {bars.length} units</DialogTrigger>
    <DialogContent fixedHeader title="All units" description={`${monthLabel}. Net income is collected minus expenses.`}>
      <UnitRows bars={bars} />
    </DialogContent>
  </Dialog>;
}
