import { formatPesos } from "@/lib/money/centavos";
import { formatShortDate } from "@/lib/dates/fleet-date";
import { formatAbsenceDates, type Absence } from "@/lib/drivers/absences";

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 rounded-md border border-rule bg-surface px-3 py-2">
    <p className="text-label font-bold text-muted">{label}</p>
    <div className="mt-1 truncate text-body font-bold text-ink">{children}</div>
  </div>;
}

/**
 * The profile's summary strip (feature 012, FR-017): today's unit, remittances in the last 30 days,
 * balance owed, and the next absence (or the last assignment). Two per row on phones, four from lg.
 */
export function SummaryStrip({ todayUnit, absentOrInactive, remittances30, balanceCentavos, nextAbsence, lastAssignmentDate }: {
  todayUnit: { id: string; name: string } | null;
  absentOrInactive: boolean;
  remittances30: number;
  balanceCentavos: number;
  nextAbsence?: Absence;
  lastAssignmentDate: string | null;
}) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <Card label="Today's unit">{absentOrInactive ? <span className="text-muted">—</span> : todayUnit ? todayUnit.name : <span className="text-muted">Unassigned</span>}</Card>
    <Card label="Remittances (last 30 days)"><span className="font-data">{remittances30}</span></Card>
    <Card label="Balance owed"><span className={`font-data ${balanceCentavos > 0 ? "text-danger" : ""}`}>{formatPesos(balanceCentavos)}</span></Card>
    {nextAbsence
      ? <Card label="Next absence">{formatAbsenceDates(nextAbsence)}</Card>
      : <Card label="Last assignment">{lastAssignmentDate ? formatShortDate(lastAssignmentDate) : <span className="text-muted">None</span>}</Card>}
  </div>;
}
