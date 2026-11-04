import type { ReportUnit } from "@/lib/reports/report-data";

/** A unit in the Single unit dropdown (contracts/reports-http.md). */
export interface UnitChoice { id: string; name: string; label: string; archived: boolean }

export function toUnitChoice(unit: ReportUnit): UnitChoice {
  return { id: unit.id, name: unit.name, label: unit.archived ? `${unit.name} (archived)` : unit.name, archived: unit.archived };
}
