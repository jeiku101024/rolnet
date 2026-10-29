import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatPesos } from "@/lib/money/centavos";

type Unpaid = { remittance_id: string; unit_id: string; body_number: string; service_date: string; balance_centavos: number };
type Balance = { driver_id: string; driver_name: string; outstanding_centavos: number; unpaid_remittance_count?: number; first_unpaid_service_date?: string; last_unpaid_service_date?: string; unpaid_remittances?: Unpaid[] };

const shown = 5;

/** Drivers who owe, with the units and service dates the balance comes from (FR-016, T124). */
export function UnpaidBalancesPanel({ items }: { items: Balance[] }) {
  return <Card className="min-w-0"><CardContent><h2 className="font-semibold">Unpaid balances</h2>{items.length ? <ul className="mt-2 divide-y divide-rule text-body-sm">{items.map((item) => {
    const unpaid = item.unpaid_remittances ?? [];
    const units = [...new Set(unpaid.map((row) => `Body ${row.body_number}`))].join(", ");
    const period = item.first_unpaid_service_date && item.last_unpaid_service_date ? (item.first_unpaid_service_date === item.last_unpaid_service_date ? item.first_unpaid_service_date : `${item.first_unpaid_service_date} to ${item.last_unpaid_service_date}`) : "";
    return <li className="grid gap-1 py-3" key={item.driver_id}>
      <div className="flex flex-wrap justify-between gap-3"><Link className="muted-link font-semibold" href={`/drivers/${item.driver_id}`}>{item.driver_name}</Link><span className="font-data font-bold">{formatPesos(item.outstanding_centavos)}</span></div>
      <p className="text-muted">{units}{period ? ` · ${period}` : ""}{item.unpaid_remittance_count ? ` · ${item.unpaid_remittance_count} unpaid ${item.unpaid_remittance_count === 1 ? "day" : "days"}` : ""}</p>
      {unpaid.length ? <ul className="flex flex-wrap gap-x-4 gap-y-1">{unpaid.slice(0, shown).map((row) => <li key={row.remittance_id}><Link className="muted-link font-data" href={`/remittances/${row.remittance_id}`}>{row.service_date} · {formatPesos(row.balance_centavos)}</Link></li>)}{unpaid.length > shown ? <li className="text-muted">and {unpaid.length - shown} more</li> : null}</ul> : null}
    </li>;
  })}</ul> : <p className="py-4 text-body-sm text-muted">No driver owes a balance.</p>}</CardContent></Card>;
}
