import Link from "next/link";
import { SectionHeading } from "@/components/ui/page-header";
import { formatShortDate } from "@/lib/dates/fleet-date";
import type { LastReplaced as Row } from "@/lib/expenses/last-replaced";

/** When each main part was last replaced on this unit (feature 011, FR-033). Each row opens the filtered Expenses list. */
export function LastReplaced({ unitId, rows }: { unitId: string; rows: Row[] }) {
  return <div>
    <SectionHeading title="Last replaced" description="The latest date replaced for each main part, from this unit's expenses." />
    <ul className="mt-4 divide-y divide-rule border-y border-rule">
      {rows.map((row) => <li key={row.category}>
        <Link className="touch-target flex items-center justify-between gap-3 px-1 hover:bg-brand-soft" href={`/expenses?unit=${unitId}&category=${row.category}`}>
          <span className="font-semibold text-ink">{row.label}</span>
          {row.replacedDate ? <span className="font-data text-ink">{formatShortDate(row.replacedDate)}, {row.replacedDate.slice(0, 4)}</span> : <span className="text-body-sm text-muted">Never recorded</span>}
        </Link>
      </li>)}
    </ul>
  </div>;
}
