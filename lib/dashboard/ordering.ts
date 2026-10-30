/**
 * Dashboard ordering, labels and month figures (feature 006, research R7–R9). Pure functions so
 * the urgency rules and centavo totals can be unit-tested without a database.
 */

export const panelLimit = 5;
/** 100 km past due counts as one day overdue, so date-due and mileage-due items rank together. */
export const kmPerDayEquivalent = 100;

export interface Panel<Item> { items: Item[]; total: number; href: string }

export function toPanel<Item>(items: Item[], href: string): Panel<Item> {
  return { items: items.slice(0, panelLimit), total: items.length, href };
}

function dayNumber(isoDate: string) {
  return Math.round(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000);
}

export function daysBetween(fromIsoDate: string, toIsoDate: string) {
  return dayNumber(toIsoDate) - dayNumber(fromIsoDate);
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Expiring documents

export interface ExpiringDocumentItem { id: string; documentType: string; holderLabel: string; expiresOn: string; daysUntil: number; bucket: string }

export function expiryText(daysUntil: number) {
  if (daysUntil < 0) return `Expired ${plural(-daysUntil, "day")} ago`;
  if (daysUntil === 0) return "Expires today";
  return `Expires in ${plural(daysUntil, "day")}`;
}

export function orderExpiringDocuments(rows: { id: string; document_type: string; expires_on: string; bucket: string; holderLabel: string }[], today: string): ExpiringDocumentItem[] {
  return rows
    .map((row) => ({ id: row.id, documentType: row.document_type, holderLabel: row.holderLabel, expiresOn: row.expires_on, daysUntil: daysBetween(today, row.expires_on), bucket: row.bucket }))
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || a.holderLabel.localeCompare(b.holderLabel));
}

// Due maintenance

export interface DueMaintenanceRow { item_type: string; item_id: string; unit_id: string; due_date: string | null; due_mileage: number | null; item_name: string; body_number: string; current_mileage: number | null }
export interface DueMaintenanceItem extends DueMaintenanceRow { daysPastDue: number | null; kmPastDue: number | null; urgency: number }

export function dueText(item: DueMaintenanceItem) {
  const parts: string[] = [];
  if (item.daysPastDue !== null) parts.push(item.daysPastDue === 0 ? "Due today" : `${plural(item.daysPastDue, "day")} overdue`);
  if (item.kmPastDue !== null) parts.push(item.kmPastDue === 0 ? "Due at this mileage" : `${item.kmPastDue.toLocaleString()} km past due`);
  return parts.join(" · ") || "Due";
}

export function orderDueMaintenance(rows: DueMaintenanceRow[], today: string): DueMaintenanceItem[] {
  return rows
    .map((row) => {
      const daysPastDue = row.due_date && row.due_date <= today ? daysBetween(row.due_date, today) : null;
      const kmPastDue = row.due_mileage !== null && row.current_mileage !== null && row.current_mileage >= row.due_mileage ? row.current_mileage - row.due_mileage : null;
      const urgency = Math.max(daysPastDue ?? 0, (kmPastDue ?? 0) / kmPerDayEquivalent);
      return { ...row, daysPastDue, kmPastDue, urgency };
    })
    .sort((a, b) => b.urgency - a.urgency || a.body_number.localeCompare(b.body_number));
}

// Unpaid balances

export interface UnpaidBalanceItem { driverId: string; driverName: string; outstandingCentavos: number; unpaidRemittanceCount: number; firstUnpaidServiceDate: string | null }

export function orderUnpaidBalances(rows: { driver_id: string; driver_name: string; outstanding_centavos: number; unpaid_remittance_count: number | null; first_unpaid_service_date: string | null }[]): UnpaidBalanceItem[] {
  return rows
    .filter((row) => Number(row.outstanding_centavos) > 0)
    .map((row) => ({ driverId: row.driver_id, driverName: row.driver_name, outstandingCentavos: Number(row.outstanding_centavos), unpaidRemittanceCount: row.unpaid_remittance_count ?? 0, firstUnpaidServiceDate: row.first_unpaid_service_date }))
    .sort((a, b) => b.outstandingCentavos - a.outstandingCentavos || (a.firstUnpaidServiceDate ?? "9999").localeCompare(b.firstUnpaidServiceDate ?? "9999"));
}

// Extradors and units in repair

export interface ExtradorItem { driverId: string; fullName: string; phone: string; currentUnit: { unitId: string; bodyNumber: string } | null; assignmentType: "backup" | "primary" | null }

export function orderExtradors(items: ExtradorItem[]) {
  return [...items].sort((a, b) => Number(Boolean(b.currentUnit)) - Number(Boolean(a.currentUnit)) || a.fullName.localeCompare(b.fullName));
}

/** Today's unit for a backup driver: today's backup assignment wins over an open primary one. */
export function currentAssignment<T extends { assignment_type: string; starts_on: string; ends_on: string | null }>(rows: T[], today: string): T | null {
  const covering = rows.filter((row) => row.starts_on <= today && (row.ends_on === null || row.ends_on >= today));
  return covering.find((row) => row.assignment_type === "backup") ?? covering.find((row) => row.assignment_type === "primary") ?? null;
}

export interface InRepairUnitItem { unitId: string; bodyNumber: string; plateNumber: string; inRepairSince: string | null; daysInRepair: number | null }

export function repairText(item: InRepairUnitItem) {
  if (item.daysInRepair === null) return "In repair";
  if (item.daysInRepair === 0) return "In repair since today";
  return `In repair for ${plural(item.daysInRepair, "day")}`;
}

export function orderInRepair(items: InRepairUnitItem[]) {
  return [...items].sort((a, b) => (a.inRepairSince === null ? 1 : 0) - (b.inRepairSince === null ? 1 : 0) || (a.inRepairSince ?? "").localeCompare(b.inRepairSince ?? "") || a.bodyNumber.localeCompare(b.bodyNumber));
}

// Month figures (integer centavos only)

export interface SummaryRow { unit_id: string; body_number: string; remittance_paid_centavos: number | null; total_expense_centavos: number | null; net_income_centavos: number | null }
export interface FleetStats { collectedCentavos: number; expenseCentavos: number; netCentavos: number; unitsActive: number; unitsInRepair: number; documentsDue: number; maintenanceDue: number }
export interface UnitIncomeBar { unitId: string; bodyNumber: string; collectedCentavos: number; expenseCentavos: number; netCentavos: number; collectedPct: number; expensePct: number }
export interface DailyCollection { date: string; collectedCentavos: number; heightPct: number }

const centavos = (value: number | null | undefined) => Number(value ?? 0);
const percent = (value: number, max: number) => (max > 0 ? Math.round((value / max) * 100) : 0);

export function monthTotals(rows: SummaryRow[]) {
  let collectedCentavos = 0;
  let expenseCentavos = 0;
  for (const row of rows) { collectedCentavos += centavos(row.remittance_paid_centavos); expenseCentavos += centavos(row.total_expense_centavos); }
  return { collectedCentavos, expenseCentavos, netCentavos: collectedCentavos - expenseCentavos };
}

export function unitIncomeBars(rows: SummaryRow[]): UnitIncomeBar[] {
  const max = Math.max(0, ...rows.flatMap((row) => [centavos(row.remittance_paid_centavos), centavos(row.total_expense_centavos)]));
  return rows
    .map((row) => { const collected = centavos(row.remittance_paid_centavos); const expense = centavos(row.total_expense_centavos); return { unitId: row.unit_id, bodyNumber: row.body_number, collectedCentavos: collected, expenseCentavos: expense, netCentavos: collected - expense, collectedPct: percent(collected, max), expensePct: percent(expense, max) }; })
    .sort((a, b) => a.bodyNumber.localeCompare(b.bodyNumber));
}

/** Payments summed per fleet-local day from the 1st of the month to today. `dateOf` converts `paid_at` to that day. */
export function dailyCollections(payments: { paid_at: string; amount_centavos: number }[], month: string, today: string, dateOf: (paidAt: string) => string): DailyCollection[] {
  const totals = new Map<string, number>();
  for (const payment of payments) { const day = dateOf(payment.paid_at); if (day.startsWith(month) && day <= today) totals.set(day, (totals.get(day) ?? 0) + centavos(payment.amount_centavos)); }
  const days: { date: string; collectedCentavos: number }[] = [];
  const lastDay = today.startsWith(month) ? Number(today.slice(8, 10)) : new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  for (let day = 1; day <= lastDay; day += 1) { const date = `${month}-${String(day).padStart(2, "0")}`; days.push({ date, collectedCentavos: totals.get(date) ?? 0 }); }
  const max = Math.max(0, ...days.map((day) => day.collectedCentavos));
  return days.map((day) => ({ ...day, heightPct: percent(day.collectedCentavos, max) }));
}
