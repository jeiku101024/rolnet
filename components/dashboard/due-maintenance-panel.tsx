import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

type MaintenanceItem = { item_id: string; item_type: string; unit_id: string; due_date: string | null; due_mileage: number | null; item_name?: string; body_number?: string; current_mileage?: number | null };

/** Why the item is due: its date has arrived, its mileage was reached, or both (FR-027). */
export function dueBasis(item: MaintenanceItem, today?: string) {
  const reasons: string[] = [];
  if (item.due_date !== null && (!today || item.due_date <= today)) reasons.push(`date ${item.due_date}`);
  if (item.due_mileage !== null && (item.current_mileage == null || item.current_mileage >= item.due_mileage)) {
    reasons.push(`${item.due_mileage.toLocaleString()} km${item.current_mileage != null ? ` (now ${item.current_mileage.toLocaleString()} km)` : ""}`);
  }
  return reasons.length ? `Due by ${reasons.join(" and ")}` : "Due";
}

export function DueMaintenancePanel({ items, today }: { items: MaintenanceItem[]; today?: string }) {
  return <Card className="min-w-0"><CardContent><h2 className="font-semibold">Maintenance due</h2>{items.length ? <ul className="mt-2 divide-y divide-rule text-body-sm">{items.map((item) => <li className="py-2" key={item.item_id}>
    <Link className="muted-link font-semibold" href={`/maintenance/${item.unit_id}`}>{item.item_name ?? item.item_type} · Body {item.body_number ?? "?"}</Link>
    <p className="font-data text-muted">{dueBasis(item, today)}</p>
  </li>)}</ul> : <p className="py-4 text-body-sm text-muted">Nothing is due.</p>}</CardContent></Card>;
}
