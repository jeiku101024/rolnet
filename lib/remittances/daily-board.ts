import type { UnitStatus } from "@/lib/status/record-status";
import { existsOn, isBlocked, statusOn, type StatusChange } from "@/lib/units/status-on";

// Feature 008, updated by feature 010: turns one date's rows into Daily view cards (data-model.md
// "Remittance board card"). Pure, so every rule is unit tested: saved records keep their own driver
// and always show (FR-045, FR-047); an unrecorded card takes the unit's saved daily assignment for
// the date (FR-043); a unit without one gets the "Assign driver" prompt (FR-044); a unit In repair
// or Retired on the date is blocked and left out of the count and total (FR-046); archived units
// never appear (FR-048), and units added after the date only show a saved record (FR-011a).

export type Disposition = "returned" | "overnight_overtime";
export type DriverRole = "primary" | "backup";

export interface DriverOnCard { driverId: string; name: string; role: DriverRole }

export interface DailyRows {
  units: { id: string; name: string; body_number: string; created_at: string; archived: boolean }[];
  statusChanges: (StatusChange & { unit_id: string })[];
  assignments: { unit_id: string; driver_id: string; driverName: string; driverRole: DriverRole }[];
  remittances: {
    id: string; unit_id: string; driver_id: string; disposition: Disposition; amount_due_centavos: number;
    allowance_centavos: number; deposit_centavos: number; notes: string | null; updated_at: string; driverName: string; driverRole: DriverRole;
    payments: { amount_centavos: number }[];
  }[];
}

interface CardBase { key: string; unitId: string; unitName: string; bodyNumber: string }
export type SavedCard = CardBase & { kind: "saved"; remittanceId: string; updatedAt: string; disposition: Disposition; dueCentavos: number; receivedCentavos: number; allowanceCentavos: number; depositCentavos: number; notes: string; driver: DriverOnCard };
export type UnrecordedCard = CardBase & { kind: "unrecorded"; driver: DriverOnCard };
export type NoDriverCard = CardBase & { kind: "no-driver" };
export type BlockedCard = CardBase & { kind: "blocked"; status: Exclude<UnitStatus, "active"> };
export type DailyCard = SavedCard | UnrecordedCard | NoDriverCard | BlockedCard;

export interface DailyBoard {
  date: string;
  today: string;
  isToday: boolean;
  cards: DailyCard[];
  recorded: number;
  countable: number;
  receivedCentavos: number;
}

const byName = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function dueFor(disposition: Disposition) {
  return disposition === "overnight_overtime" ? 30000 : 18000;
}

/** Cards that count toward "N of M recorded": saved, unrecorded, and units waiting for a driver. */
export function isCountable(card: DailyCard) {
  return card.kind !== "blocked";
}

export function buildDailyBoard({ date, today, rows }: { date: string; today: string; rows: DailyRows }): DailyBoard {
  const cards: DailyCard[] = [];
  const units = [...rows.units].sort((a, b) => byName.compare(a.name, b.name));
  for (const unit of units) {
    if (unit.archived) continue;
    const base: CardBase = { key: `${date}:${unit.id}`, unitId: unit.id, unitName: unit.name, bodyNumber: unit.body_number };
    const saved = rows.remittances.find((row) => row.unit_id === unit.id);
    if (saved) {
      cards.push({
        ...base, kind: "saved", remittanceId: saved.id, updatedAt: saved.updated_at, disposition: saved.disposition, dueCentavos: Number(saved.amount_due_centavos),
        receivedCentavos: saved.payments.reduce((sum, payment) => sum + Number(payment.amount_centavos), 0),
        allowanceCentavos: Number(saved.allowance_centavos), depositCentavos: Number(saved.deposit_centavos), notes: saved.notes ?? "",
        driver: { driverId: saved.driver_id, name: saved.driverName, role: saved.driverRole },
      });
      continue;
    }
    if (!existsOn(unit.created_at, date)) continue;
    const status = statusOn(rows.statusChanges.filter((change) => change.unit_id === unit.id), date);
    if (isBlocked(status)) { cards.push({ ...base, kind: "blocked", status: status as BlockedCard["status"] }); continue; }
    const assignment = rows.assignments.find((row) => row.unit_id === unit.id);
    cards.push(assignment
      ? { ...base, kind: "unrecorded", driver: { driverId: assignment.driver_id, name: assignment.driverName, role: assignment.driverRole } }
      : { ...base, kind: "no-driver" });
  }
  const recorded = cards.filter((card) => card.kind === "saved").length;
  const countable = cards.filter(isCountable).length;
  const receivedCentavos = cards.reduce((sum, card) => sum + (card.kind === "saved" ? card.receivedCentavos : 0), 0);
  return { date, today, isToday: date === today, cards, recorded, countable, receivedCentavos };
}
