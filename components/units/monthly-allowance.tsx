import { SectionHeading } from "@/components/ui/page-header";
import { MoneyText } from "@/components/remittances/money-text";
import { formatMonth, type MonthlyAllowanceBlock } from "@/lib/units/monthly-allowance";

function Bar({ label, centavos, width, tone }: { label: string; centavos: number; width: number; tone: string }) {
  return <div className="grid gap-1">
    <div className="flex justify-between gap-2 text-body-sm"><span className="text-muted">{label}</span><span className="font-data text-ink"><MoneyText centavos={centavos} /></span></div>
    <div className="h-2 overflow-hidden rounded-sm bg-rule"><div className={`h-full ${tone}`} style={{ width: `${width}%` }} /></div>
  </div>;
}

/** Monthly expenses vs allowance on the unit page (feature 010, FR-041). */
export function MonthlyAllowance({ blocks }: { blocks: MonthlyAllowanceBlock[] }) {
  return <div>
    <SectionHeading title="Monthly expenses vs allowance" description="The last 12 months with remittances or expenses." />
    {blocks.length ? <ul className="mt-4 grid gap-3 md:grid-cols-2">
      {blocks.map((block) => <li key={block.month} className="grid gap-3 rounded-md border border-rule bg-surface p-4">
        <p className="font-semibold text-ink">{formatMonth(block.month)}</p>
        <Bar label="Allowance" centavos={block.allowanceCentavos} width={block.allowanceWidth} tone="bg-ok" />
        <Bar label="Expenses" centavos={block.expensesCentavos} width={block.expensesWidth} tone="bg-warn" />
        <p className="flex justify-between gap-2 border-t border-rule pt-2 text-body-sm font-bold"><span>Net</span><span className="font-data"><MoneyText centavos={block.netCentavos} /></span></p>
      </li>)}
    </ul> : <p className="mt-4 border-y border-rule py-6 text-body-sm text-muted">No remittances or expenses in the last 12 months.</p>}
  </div>;
}
