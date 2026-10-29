import { formatPesos } from "@/lib/money/centavos";

export type PartRow = { id: string; part_name: string; replaced_on: string; replacement_mileage: number | null; cost_centavos: number; next_due_date: string | null; next_due_mileage: number | null; notes: string | null };

function dueText(part: PartRow) {
  const parts = [part.next_due_date ? `on ${part.next_due_date}` : null, part.next_due_mileage !== null ? `at ${part.next_due_mileage.toLocaleString()} km` : null].filter(Boolean);
  return `Next due ${parts.join(" or ")}`;
}

/** Part replacements, newest first, with date, mileage, cost and due basis (FR-019). */
export function PartsList({ parts }: { parts: PartRow[] }) {
  if (!parts.length) return <p className="border-y border-rule py-6 text-body-sm text-muted">No part replacements recorded yet.</p>;
  return <ul className="divide-y divide-rule border-y border-rule">{parts.map((part) => <li className="grid gap-1 py-3 text-body-sm" key={part.id}>
    <div className="flex flex-wrap justify-between gap-3"><span className="font-semibold">{part.part_name}</span><span className="font-data">{formatPesos(part.cost_centavos)}</span></div>
    <p className="font-data text-muted">Replaced {part.replaced_on}{part.replacement_mileage !== null ? ` at ${part.replacement_mileage.toLocaleString()} km` : ""} · {dueText(part)}</p>
    {part.notes ? <p className="text-muted">{part.notes}</p> : null}
  </li>)}</ul>;
}
