import type { UnitStatus } from "@/lib/status/record-status";
import { existsOn, isBlocked, statusOn, type StatusChange } from "@/lib/units/status-on";

// Feature 010: turns one date's rows into Daily assignment cards (data-model.md "Assignment board
// card"). Pure, so every rule is unit tested: one card per non-archived unit that exists on the date
// (FR-011, FR-011a); a saved assignment locks the card, and a remittance on that day locks it for
// good (FR-019, FR-019a); a unit In repair or Retired on the date is blocked (FR-026); dropdowns
// list only eligible drivers not saved on another unit that date (FR-014, FR-015); future dates
// pre-fill each open card with the unit's latest earlier driver (FR-021).

export type DriverKind = "primary" | "backup";

export interface AssignmentRows {
  units: { id: string; name: string; body_number: string; plate_number: string; make_model: string; created_at: string; current_mileage?: number }[];
  statusChanges: (StatusChange & { unit_id: string })[];
  assignments: { id: string; unit_id: string; driver_id: string; notes: string | null; updated_at: string; driverName: string; driverKind: DriverKind }[];
  /** Units with a saved remittance on the date: their assignment can no longer change. */
  remittanceUnitIds: string[];
  drivers: { id: string; full_name: string; driver_kind: DriverKind; is_active: boolean; license_expiry_date: string }[];
  /** Each unit's latest saved assignment before the date (future dates only). */
  prefill: { unit_id: string; driver_id: string }[];
}

export interface DriverOption { id: string; label: string }

/** `currentMileage` feeds the card's "Record mileage" dialog (feature 011). */
interface CardBase { key: string; unitId: string; unitName: string; subheader: string; options: DriverOption[]; currentMileage: number }
export type OpenCard = CardBase & { kind: "open"; prefillDriverId: string | null };
export type SavedCard = CardBase & { kind: "saved" | "locked"; assignmentId: string; driverId: string; driverLabel: string; notes: string; updatedAt: string };
export type BlockedCard = CardBase & { kind: "blocked"; status: Exclude<UnitStatus, "active"> };
export type AssignmentCard = OpenCard | SavedCard | BlockedCard;

export interface AssignmentBoard {
  date: string;
  today: string;
  isToday: boolean;
  isFuture: boolean;
  cards: AssignmentCard[];
  /** Saved (and locked) cards. */
  assigned: number;
  /** Every card except blocked ones (FR-010). */
  assignable: number;
}

const byName = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function roleLabel(kind: DriverKind) {
  return kind === "backup" ? "Backup" : "Primary";
}

export function driverLabel(name: string, kind: DriverKind) {
  return `${name} (${roleLabel(kind)})`;
}

export function buildAssignmentBoard({ date, today, rows }: { date: string; today: string; rows: AssignmentRows }): AssignmentBoard {
  const isFuture = date > today;
  const eligible = rows.drivers
    .filter((driver) => driver.is_active && driver.license_expiry_date >= date)
    .sort((a, b) => byName.compare(a.full_name, b.full_name));
  const savedOn = new Map(rows.assignments.map((row) => [row.unit_id, row]));
  const takenBy = new Map(rows.assignments.map((row) => [row.driver_id, row.unit_id]));
  const locked = new Set(rows.remittanceUnitIds);
  const prefillOf = new Map(rows.prefill.map((row) => [row.unit_id, row.driver_id]));

  // A driver is available to a card unless saved on another unit that date; the card's own driver stays listed.
  const optionsFor = (unitId: string): DriverOption[] =>
    eligible.filter((driver) => (takenBy.get(driver.id) ?? unitId) === unitId).map((driver) => ({ id: driver.id, label: driverLabel(driver.full_name, driver.driver_kind) }));

  const cards: AssignmentCard[] = [];
  const units = rows.units.filter((unit) => existsOn(unit.created_at, date)).sort((a, b) => byName.compare(a.name, b.name));
  for (const unit of units) {
    const base: CardBase = { key: `${date}:${unit.id}`, unitId: unit.id, unitName: unit.name, subheader: `${unit.body_number} · ${unit.plate_number} · ${unit.make_model}`, options: optionsFor(unit.id), currentMileage: unit.current_mileage ?? 0 };
    const saved = savedOn.get(unit.id);
    if (saved) {
      cards.push({ ...base, kind: locked.has(unit.id) ? "locked" : "saved", assignmentId: saved.id, driverId: saved.driver_id, driverLabel: driverLabel(saved.driverName, saved.driverKind), notes: saved.notes ?? "", updatedAt: saved.updated_at });
      continue;
    }
    const status = statusOn(rows.statusChanges.filter((change) => change.unit_id === unit.id), date);
    if (isBlocked(status)) {
      cards.push({ ...base, options: [], kind: "blocked", status: status as BlockedCard["status"] });
      continue;
    }
    const candidate = isFuture ? prefillOf.get(unit.id) ?? null : null;
    const prefillDriverId = candidate && base.options.some((option) => option.id === candidate) ? candidate : null;
    cards.push({ ...base, kind: "open", prefillDriverId });
  }
  const assigned = cards.filter((card) => card.kind === "saved" || card.kind === "locked").length;
  const assignable = cards.filter((card) => card.kind !== "blocked").length;
  return { date, today, isToday: date === today, isFuture, cards, assigned, assignable };
}
