import { addDays, fleetToday } from "@/lib/dates/fleet-date";
import type { ExpenseCategory } from "@/lib/expenses/categories";

export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const demoMasterEmail = process.env.DEMO_MASTER_EMAIL || "owner@demo.local";
export const demoMasterPassword = process.env.DEMO_MASTER_PASSWORD || "demo1234";

// Feature 006: enough demo rows that lists span several pages and every dashboard panel has data.
const today = fleetToday();
const pad = (value: number, size = 2) => String(value).padStart(size, "0");
const demoId = (group: number, index: number) => `00000000-0000-4000-8000-${pad(group, 4)}${pad(index, 8)}`;

const extraUnitModels = ["Honda TMX", "Yamaha YTX", "Suzuki Raider", "Kawasaki Barako"];
const demoUnitRows = [
  { id: "00000000-0000-4000-8000-000000000001", name: "ROLNET-1", body_number: "T-001", plate_number: "ABC-1234", make_model: "Honda TMX", status: "active", current_mileage: 18240 },
  { id: "00000000-0000-4000-8000-000000000002", name: "ROLNET-2", body_number: "T-002", plate_number: "ABC-1235", make_model: "Yamaha YTX", status: "in_repair", current_mileage: 24110 },
  ...Array.from({ length: 10 }, (_, index) => ({ id: demoId(1, index + 3), name: `ROLNET-${index + 3}`, body_number: `T-${pad(index + 3, 3)}`, plate_number: `ABC-${1236 + index}`, make_model: extraUnitModels[index % extraUnitModels.length], status: index === 4 ? "in_repair" : index === 9 ? "retired" : "active", current_mileage: 15000 + index * 1375 })),
];
// Feature 010: every demo unit was added 60 days ago; ROLNET-12 (retired) is also archived.
export const demoUnits = demoUnitRows.map((unit) => ({
  ...unit,
  created_at: `${addDays(today, -60)}T00:00:00Z`,
  archived: unit.name === "ROLNET-12",
  archived_at: unit.name === "ROLNET-12" ? `${addDays(today, -5)}T08:00:00Z` : null as string | null,
}));

const extraDriverNames = ["Maria Reyes", "Jose Garcia", "Ana Bautista", "Ramon Cruz", "Liza Mendoza", "Carlo Villanueva", "Nestor Aquino", "Rosa Lim", "Danilo Ramos", "Grace Torres", "Arnel Flores", "Vilma Castro", "Rey Navarro"];
export const demoDrivers = [
  { id: "00000000-0000-4000-8000-000000000011", full_name: "Juan Dela Cruz", driver_kind: "primary", license_number: "N01-23-456789", license_expiry_date: "2027-06-30", phone: "09171234567", is_active: true },
  { id: "00000000-0000-4000-8000-000000000012", full_name: "Pedro Santos", driver_kind: "backup", license_number: "N01-23-456790", license_expiry_date: "2027-03-15", phone: "09181234567", is_active: true },
  ...extraDriverNames.map((full_name, index) => ({ id: demoId(2, index + 13), full_name, driver_kind: index < 2 ? "backup" : "primary", license_number: `N01-23-${456791 + index}`, license_expiry_date: addDays(today, 90 + index * 30), phone: `0917${pad(2000000 + index, 7)}`, is_active: index !== 12 })),
];

// Feature 007: the eight active primary drivers, one per unit ROLNET-1 to ROLNET-8.
const demoPrimaryDrivers = demoDrivers.filter((driver) => driver.driver_kind === "primary" && driver.is_active).slice(0, 8);

// Feature 010: daily assignments for the last 7 days and today. Each active unit keeps its primary
// driver, except ROLNET-3, which Pedro Santos (a backup driver) drives today. ROLNET-2 and ROLNET-7
// are in repair (no assignments while blocked); ROLNET-8 to ROLNET-11 are unassigned today, so
// their drivers are free in the dropdowns. Nothing is saved for future dates (they show pre-fill).
const demoDailyUnits = [0, 2, 3, 4, 5];
export const demoUnitAssignmentsDaily = Array.from({ length: 8 }, (_, back) => addDays(today, back - 7)).flatMap((date, dayIndex) =>
  demoDailyUnits.map((unitIndex, slot) => {
    const coveredToday = date === today && unitIndex === 2;
    const driver = coveredToday ? demoDrivers[1] : demoPrimaryDrivers[unitIndex];
    return { id: demoId(8, dayIndex * 10 + slot + 1), unit_id: demoUnits[unitIndex].id, driver_id: driver.id, service_date: date, notes: coveredToday ? "Covering today" : null as string | null, updated_at: `${date}T07:00:00Z`, driverName: driver.full_name, driverKind: driver.driver_kind as "primary" | "backup" };
  }));

/** Feature 010: status history. ROLNET-2 went into repair 9 days ago, ROLNET-7 3 days ago, ROLNET-12 retired 20 days ago. */
export const demoUnitStatusChanges = [
  { unit_id: demoUnits[1].id, from_status: "active", to_status: "in_repair", effective_on: addDays(today, -9), changed_at: `${addDays(today, -9)}T02:00:00Z`, changed_by: null as string | null },
  { unit_id: demoUnits[6].id, from_status: "active", to_status: "in_repair", effective_on: addDays(today, -3), changed_at: `${addDays(today, -3)}T02:00:00Z`, changed_by: null as string | null },
  { unit_id: demoUnits[11].id, from_status: "active", to_status: "retired", effective_on: addDays(today, -20), changed_at: `${addDays(today, -20)}T02:00:00Z`, changed_by: null as string | null },
] as const;

// Feature 011: fixed categories. Main categories carry a date replaced; Others carry a typed name.
// Two rows were moved from the old maintenance records (one ₱0, marked for review).
type DemoExpense = { id: string; unit_id: string; category: ExpenseCategory; custom_category: string | null; replaced_date: string | null; expense_date: string; amount_centavos: number; notes: string | null; needs_review: boolean; source_table: string | null; updated_at: string; receipt_object_path: string | null; units: { body_number: string; plate_number: string; name: string }[] };
const demoExpenseUnit = (index: number) => [{ body_number: demoUnits[index].body_number, plate_number: demoUnits[index].plate_number, name: demoUnits[index].name }];
const demoMainCycle: ExpenseCategory[] = ["rear_tire", "chain", "battery", "engine_sprocket", "rear_sprocket", "front_tire", "change_oil"];
const demoOthersCycle = ["Fuel", "Brake pads", "Registration", "Fuel"];
function demoExpense(row: Pick<DemoExpense, "id" | "unit_id" | "category" | "expense_date" | "amount_centavos" | "notes" | "receipt_object_path"> & Partial<DemoExpense>, unitIndex: number): DemoExpense {
  const others = row.category === "others";
  return { custom_category: null, replaced_date: others ? null : row.expense_date, needs_review: false, source_table: null, updated_at: `${row.expense_date}T08:00:00Z`, units: demoExpenseUnit(unitIndex), ...row };
}

export const demoExpenses: DemoExpense[] = [
  demoExpense({ id: "00000000-0000-4000-8000-000000000041", unit_id: demoUnits[0].id, category: "change_oil", expense_date: addDays(today, -1), amount_centavos: 185000, notes: "Monthly tune-up", receipt_object_path: null }, 0),
  ...Array.from({ length: 11 }, (_, index) => {
    const category: ExpenseCategory = index < 7 ? demoMainCycle[index] : "others";
    return demoExpense({ id: demoId(4, index + 2), unit_id: demoUnits[index % 4].id, category, custom_category: category === "others" ? demoOthersCycle[index - 7] : null, expense_date: addDays(today, -(index + 2)), amount_centavos: 25000 + index * 5000, notes: index % 2 ? "Paid at the shop on the highway" : "", receipt_object_path: index % 3 ? "demo" : null }, index % 4);
  }),
  // Feature 009: older registration fees so every week of the demo reports has an expense.
  ...[14, 19, 24, 29].map((daysAgo, index) => demoExpense({ id: demoId(4, index + 20), unit_id: demoUnits[3].id, category: "others", custom_category: "Registration", expense_date: addDays(today, -daysAgo), amount_centavos: 15000, notes: "", receipt_object_path: null }, 3)),
  // Feature 011: moved from the old maintenance records.
  demoExpense({ id: demoId(4, 30), unit_id: demoUnits[3].id, category: "rear_tire", expense_date: addDays(today, -35), amount_centavos: 110000, notes: "Rear left · Dunlop · 16000 km", receipt_object_path: null, source_table: "tire_installations" }, 3),
  demoExpense({ id: demoId(4, 31), unit_id: demoUnits[4].id, category: "others", custom_category: "Brake shoes", expense_date: addDays(today, -40), amount_centavos: 0, notes: "Next due 17500 km", receipt_object_path: null, needs_review: true, source_table: "part_replacements" }, 4),
];

export const demoRemittances = Array.from({ length: 30 }, (_, index) => {
  const unit = demoUnits[index % 3];
  const driver = demoDrivers[index % 4];
  const due = index % 5 === 0 ? 30000 : 18000;
  // Feature 009: one unpaid record (deposit −₱40.00) for the List view and reports.
  const paid = index === 22 ? 0 : index % 7 === 3 ? due - 8000 : due;
  return { id: index === 0 ? "00000000-0000-4000-8000-000000000051" : demoId(5, index + 1), service_date: addDays(today, -index), disposition: due === 30000 ? "overnight_overtime" : "returned", amount_due_centavos: due, notes: "", updated_at: `${addDays(today, -index)}T08:00:00Z`, units: [{ body_number: unit.body_number }], drivers: [{ full_name: driver.full_name }], allowance_centavos: 4000, deposit_centavos: paid - 4000, remittance_payments: paid ? [{ amount_centavos: paid }] : [], unit_id: unit.id, driver_id: driver.id };
});

export const demoDocuments = [
  { id: "00000000-0000-4000-8000-000000000061", document_type: "insurance", document_number: "INS-0001", expires_on: addDays(today, 10), object_path: "demo", lifecycle_status: "current", unit_id: demoUnits[0].id, driver_id: null as string | null, created_at: `${addDays(today, -40)}T08:00:00Z` },
  { id: demoId(6, 2), document_type: "or_cr", document_number: "ORCR-0002", expires_on: addDays(today, -3), object_path: "demo", lifecycle_status: "current", unit_id: demoUnits[1].id, driver_id: null as string | null, created_at: `${addDays(today, -30)}T08:00:00Z` },
  { id: demoId(6, 3), document_type: "mtop_franchise", document_number: "MTOP-0003", expires_on: addDays(today, 2), object_path: "demo", lifecycle_status: "current", unit_id: demoUnits[2].id, driver_id: null as string | null, created_at: `${addDays(today, -20)}T08:00:00Z` },
  { id: demoId(6, 4), document_type: "driver_license", document_number: "N01-23-456790", expires_on: addDays(today, 25), object_path: "demo", lifecycle_status: "current", unit_id: null as string | null, driver_id: demoDrivers[1].id, created_at: `${addDays(today, -10)}T08:00:00Z` },
  ...Array.from({ length: 8 }, (_, index) => ({ id: demoId(6, index + 5), document_type: index % 2 ? "insurance" : "or_cr", document_number: `DOC-${pad(index + 5, 4)}`, expires_on: addDays(today, 120 + index * 15), object_path: "demo", lifecycle_status: "current", unit_id: demoUnits[(index % 8) + 3].id as string | null, driver_id: null as string | null, created_at: `${addDays(today, -60 - index)}T08:00:00Z` })),
];

/** When each demo unit in repair went into repair. T-007 has no recorded time. */
export const demoInRepairSince: Record<string, string> = { [demoUnits[1].id]: `${addDays(today, -9)}T02:00:00Z` };

export const demoAuditEvents = Array.from({ length: 15 }, (_, index) => ({ id: 15 - index, occurred_at: `${addDays(today, -index)}T08:00:00Z`, action: index === 14 ? "insert" : index % 3 ? "update" : "insert", entity_type: ["units", "drivers", "remittances", "expenses", "documents"][index % 5] }));
