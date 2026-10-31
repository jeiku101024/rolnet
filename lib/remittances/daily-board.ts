import { coverageOn, type AssignmentRow, type DayOffRow } from "@/lib/assignments/coverage";

// Feature 008: turns one date's rows into Daily view cards (data-model.md). Pure, so every rule is
// unit tested: saved records keep their own driver (FR-013); unrecorded cards follow the schedule in
// effect on that date (FR-011); a day off with no backup, or a unit in repair today, is "not
// operating" and left out of the count (FR-008, FR-014, FR-014a).

export type Disposition = "returned" | "overnight_overtime";

export interface DriverOnCard { driverId: string; name: string; role: "primary" | "backup"; coveringFor: string | null }

export interface DailyRows {
  units: { id: string; name: string; body_number: string; status: string }[];
  assignments: (AssignmentRow & { unit_id: string })[];
  daysOff: DayOffRow[];
  remittances: {
    id: string; unit_id: string; driver_id: string; assignment_id: string; disposition: Disposition; amount_due_centavos: number;
    allowance_centavos: number; deposit_centavos: number; notes: string | null; updated_at: string; driverName: string; assignmentType: "primary" | "backup"; coveringFor: string | null;
    payments: { amount_centavos: number }[];
  }[];
  drivers: { id: string; full_name: string; is_active: boolean; license_expiry_date: string }[];
}

interface CardBase { key: string; unitId: string; unitName: string; bodyNumber: string }
export type SavedCard = CardBase & { kind: "saved"; remittanceId: string; updatedAt: string; disposition: Disposition; dueCentavos: number; receivedCentavos: number; allowanceCentavos: number; depositCentavos: number; notes: string; driver: DriverOnCard };
export type UnrecordedCard = CardBase & { kind: "unrecorded"; assignmentId: string; driver: DriverOnCard };
export type NoDriverCard = CardBase & { kind: "no-driver"; dayOffId: string; primaryDriverName: string };
export type InRepairCard = CardBase & { kind: "in-repair" };
export type DailyCard = SavedCard | UnrecordedCard | NoDriverCard | InRepairCard;

export interface DailyBoard {
  date: string;
  today: string;
  isToday: boolean;
  cards: DailyCard[];
  recorded: number;
  countable: number;
  receivedCentavos: number;
  freeDrivers: { id: string; name: string }[];
}

const byName = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function dueFor(disposition: Disposition) {
  return disposition === "overnight_overtime" ? 30000 : 18000;
}

export function buildDailyBoard({ date, today, rows, isOwner }: { date: string; today: string; rows: DailyRows; isOwner: boolean }): DailyBoard {
  const isToday = date === today;
  const cards: DailyCard[] = [];
  const units = [...rows.units].sort((a, b) => byName.compare(a.name, b.name));
  for (const unit of units) {
    const base: CardBase = { key: `${date}:${unit.id}`, unitId: unit.id, unitName: unit.name, bodyNumber: unit.body_number };
    const saved = rows.remittances.find((row) => row.unit_id === unit.id);
    if (saved) {
      cards.push({
        ...base, kind: "saved", remittanceId: saved.id, updatedAt: saved.updated_at, disposition: saved.disposition, dueCentavos: Number(saved.amount_due_centavos),
        receivedCentavos: saved.payments.reduce((sum, payment) => sum + Number(payment.amount_centavos), 0),
        allowanceCentavos: Number(saved.allowance_centavos), depositCentavos: Number(saved.deposit_centavos), notes: saved.notes ?? "",
        driver: { driverId: saved.driver_id, name: saved.driverName, role: saved.assignmentType, coveringFor: saved.coveringFor },
      });
      continue;
    }
    if (isToday && unit.status === "retired") continue;
    const { primary, dayOff, backup, operator } = coverageOn(date, rows.assignments.filter((row) => row.unit_id === unit.id), rows.daysOff);
    if (!primary) continue;
    if (isToday && unit.status === "in_repair") cards.push({ ...base, kind: "in-repair" });
    else if (dayOff && !backup) cards.push({ ...base, kind: "no-driver", dayOffId: dayOff.id, primaryDriverName: primary.driverName });
    else if (operator) cards.push({ ...base, kind: "unrecorded", assignmentId: operator.id, driver: { driverId: operator.driver_id, name: operator.driverName, role: backup ? "backup" : "primary", coveringFor: backup ? primary.driverName : null } });
  }
  const recorded = cards.filter((card) => card.kind === "saved").length;
  const countable = recorded + cards.filter((card) => card.kind === "unrecorded").length;
  const receivedCentavos = cards.reduce((sum, card) => sum + (card.kind === "saved" ? card.receivedCentavos : 0), 0);
  // A driver with any assignment covering the date is busy there (the database rejects them as backup).
  const busy = new Set(rows.assignments.map((row) => row.driver_id));
  const freeDrivers = isOwner ? rows.drivers.filter((driver) => driver.is_active && driver.license_expiry_date >= date && !busy.has(driver.id)).map((driver) => ({ id: driver.id, name: driver.full_name })).sort((a, b) => byName.compare(a.name, b.name)) : [];
  return { date, today, isToday, cards, recorded, countable, receivedCentavos, freeDrivers };
}
