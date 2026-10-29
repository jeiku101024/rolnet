import { formatPesos } from "@/lib/money/centavos";
import { tirePositionLabels, tirePositions } from "@/lib/validation/maintenance";

export type TireRow = { id: string; position: string; brand: string; installed_on: string; installed_mileage: number | null; cost_centavos: number; next_due_date: string | null; next_due_mileage: number | null; replaced_by_id: string | null };

function details(tire: TireRow) {
  return `${tire.installed_on}${tire.installed_mileage !== null ? ` · ${tire.installed_mileage.toLocaleString()} km` : ""} · ${formatPesos(tire.cost_centavos)}`;
}

/** Current tire at each position, with readable position labels (FR-021). */
export function TirePositions({ tires }: { tires: TireRow[] }) {
  return <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-3">{tirePositions.map((position) => {
    const tire = tires.find((item) => item.position === position && !item.replaced_by_id);
    return <li className="bg-surface p-3 text-body-sm" key={position}><p className="text-label font-bold uppercase text-muted">{tirePositionLabels[position]}</p>{tire ? <><p className="mt-1 font-semibold">{tire.brand}</p><p className="font-data text-muted">{details(tire)}</p><p className="font-data text-muted">Due {[tire.next_due_date, tire.next_due_mileage !== null ? `${tire.next_due_mileage.toLocaleString()} km` : null].filter(Boolean).join(" or ")}</p></> : <p className="mt-1 text-muted">No tire recorded</p>}</li>;
  })}</ul>;
}

/** Replaced tires, newest first (tire history). */
export function TireHistory({ tires }: { tires: TireRow[] }) {
  const history = tires.filter((tire) => tire.replaced_by_id);
  if (!history.length) return <p className="border-y border-rule py-6 text-body-sm text-muted">No replaced tires yet.</p>;
  return <ul className="divide-y divide-rule border-y border-rule">{history.map((tire) => <li key={tire.id} className="flex flex-wrap justify-between gap-3 py-3 text-body-sm"><span><span className="font-semibold">{tirePositionLabels[tire.position] ?? tire.position}</span> · {tire.brand}</span><span className="font-data text-muted">Installed {details(tire)}</span></li>)}</ul>;
}
