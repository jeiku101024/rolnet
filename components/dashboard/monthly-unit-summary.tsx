import { Card, CardContent } from "@/components/ui/card";
import { formatPesos } from "@/lib/money/centavos";
import { SectionHeading } from "@/components/ui/page-header";

type Row = { unit_id: string; body_number: string; remittance_paid_centavos: number; total_expense_centavos: number };

export function MonthlyUnitSummary({ rows }: { rows: Row[] }) {
  return <Card className="min-w-0"><CardContent><SectionHeading title="This month by unit" description="Paid income and recorded expenses for the selected month." />{rows.length ? <div className="mt-4 data-region"><div className="data-scroll"><table className="data-table"><thead><tr><th>Unit</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead><tbody>{rows.map((r) => <tr key={r.unit_id}><td className="font-semibold">Body {r.body_number}</td><td className="font-data text-data">{formatPesos(r.remittance_paid_centavos)}</td><td className="font-data text-data">{formatPesos(r.total_expense_centavos)}</td><td className="font-data text-data font-bold">{formatPesos(r.remittance_paid_centavos - r.total_expense_centavos)}</td></tr>)}</tbody></table></div></div> : <p className="py-6 text-body-sm text-muted">No monthly unit records yet.</p>}</CardContent></Card>;
}
