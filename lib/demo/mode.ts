import { addDays, fleetToday } from "@/lib/dates/fleet-date";

export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const demoMasterEmail = process.env.DEMO_MASTER_EMAIL || "owner@demo.local";
export const demoMasterPassword = process.env.DEMO_MASTER_PASSWORD || "demo1234";

// Feature 006: enough demo rows that lists span several pages and every dashboard panel has data.
const today = fleetToday();
const pad = (value: number, size = 2) => String(value).padStart(size, "0");
const demoId = (group: number, index: number) => `00000000-0000-4000-8000-${pad(group, 4)}${pad(index, 8)}`;

const extraUnitModels = ["Honda TMX", "Yamaha YTX", "Suzuki Raider", "Kawasaki Barako"];
export const demoUnits = [
  { id: "00000000-0000-4000-8000-000000000001", name: "ROLNET-1", body_number: "T-001", plate_number: "ABC-1234", make_model: "Honda TMX", status: "active", current_mileage: 18240 },
  { id: "00000000-0000-4000-8000-000000000002", name: "ROLNET-2", body_number: "T-002", plate_number: "ABC-1235", make_model: "Yamaha YTX", status: "in_repair", current_mileage: 24110 },
  ...Array.from({ length: 10 }, (_, index) => ({ id: demoId(1, index + 3), name: `ROLNET-${index + 3}`, body_number: `T-${pad(index + 3, 3)}`, plate_number: `ABC-${1236 + index}`, make_model: extraUnitModels[index % extraUnitModels.length], status: index === 4 ? "in_repair" : index === 9 ? "retired" : "active", current_mileage: 15000 + index * 1375 })),
];

const extraDriverNames = ["Maria Reyes", "Jose Garcia", "Ana Bautista", "Ramon Cruz", "Liza Mendoza", "Carlo Villanueva", "Nestor Aquino", "Rosa Lim", "Danilo Ramos", "Grace Torres", "Arnel Flores", "Vilma Castro", "Rey Navarro"];
export const demoDrivers = [
  { id: "00000000-0000-4000-8000-000000000011", full_name: "Juan Dela Cruz", driver_kind: "primary", license_number: "N01-23-456789", license_expiry_date: "2027-06-30", phone: "09171234567", is_active: true },
  { id: "00000000-0000-4000-8000-000000000012", full_name: "Pedro Santos", driver_kind: "backup", license_number: "N01-23-456790", license_expiry_date: "2027-03-15", phone: "09181234567", is_active: true },
  ...extraDriverNames.map((full_name, index) => ({ id: demoId(2, index + 13), full_name, driver_kind: index < 2 ? "backup" : "primary", license_number: `N01-23-${456791 + index}`, license_expiry_date: addDays(today, 90 + index * 30), phone: `0917${pad(2000000 + index, 7)}`, is_active: index !== 12 })),
];

export const demoCategories = [
  { id: "00000000-0000-4000-8000-000000000021", name: "Fuel" },
  { id: "00000000-0000-4000-8000-000000000022", name: "Repairs" },
  { id: "00000000-0000-4000-8000-000000000023", name: "Registration" },
  { id: "00000000-0000-4000-8000-000000000024", name: "Insurance" },
];

export const demoAssignments = [{ id: "00000000-0000-4000-8000-000000000031", assignment_type: "primary", starts_on: "2026-01-01", ends_on: null, units: [{ body_number: "T-001" }], drivers: [{ full_name: "Juan Dela Cruz" }] }];
/** Today's backup coverage: Pedro Santos drives T-003; the other two extradors are free. */
export const demoBackupAssignments = [{ id: demoId(3, 1), driver_id: "00000000-0000-4000-8000-000000000012", unit_id: demoUnits[2].id, assignment_type: "backup", starts_on: today, ends_on: today }];

// Feature 007: the units register's Current driver column. ROLNET-1 to ROLNET-8 have primary
// drivers; ROLNET-2's driver is off today with no backup, and ROLNET-3's is off with Pedro Santos
// covering (matching demoBackupAssignments); ROLNET-9 to ROLNET-12 are unassigned.
const demoPrimaryDrivers = demoDrivers.filter((driver) => driver.driver_kind === "primary" && driver.is_active).slice(0, 8);
const demoUnitPrimaries = demoPrimaryDrivers.map((driver, index) => ({ id: demoId(3, index + 11), unit_id: demoUnits[index].id, driver_id: driver.id, driverName: driver.full_name, assignment_type: "primary", starts_on: addDays(today, -30), ends_on: null, covered_primary_assignment_id: null }));
export const demoUnitAssignments = [
  ...demoUnitPrimaries,
  { id: demoBackupAssignments[0].id, unit_id: demoUnits[2].id, driver_id: demoDrivers[1].id, driverName: demoDrivers[1].full_name, assignment_type: "backup", starts_on: today, ends_on: today, covered_primary_assignment_id: demoUnitPrimaries[2].id },
];
export const demoUnitDaysOff = [
  { id: demoId(3, 21), primary_assignment_id: demoUnitPrimaries[1].id, day_off_date: today, notes: null },
  { id: demoId(3, 22), primary_assignment_id: demoUnitPrimaries[2].id, day_off_date: today, notes: null },
];

export const demoExpenses = [
  { id: "00000000-0000-4000-8000-000000000041", unit_id: "00000000-0000-4000-8000-000000000001", category_id: "00000000-0000-4000-8000-000000000022", expense_date: addDays(today, -1), amount_centavos: 185000, notes: "Monthly tune-up", receipt_object_path: null, units: [{ body_number: "T-001", plate_number: "ABC-1234" }], expense_categories: [{ name: "Repairs" }] },
  ...Array.from({ length: 11 }, (_, index) => ({ id: demoId(4, index + 2), unit_id: demoUnits[index % 4].id, category_id: demoCategories[index % 2].id, expense_date: addDays(today, -(index + 2)), amount_centavos: 25000 + index * 5000, notes: index % 2 ? "Gasoline" : "", receipt_object_path: index % 3 ? "demo" : null, units: [{ body_number: demoUnits[index % 4].body_number, plate_number: demoUnits[index % 4].plate_number }], expense_categories: [{ name: demoCategories[index % 2].name }] })),
];

export const demoRemittances = Array.from({ length: 30 }, (_, index) => {
  const unit = demoUnits[index % 3];
  const driver = demoDrivers[index % 4];
  const due = index % 5 === 0 ? 30000 : 18000;
  const paid = index % 7 === 3 ? due - 8000 : due;
  return { id: index === 0 ? "00000000-0000-4000-8000-000000000051" : demoId(5, index + 1), service_date: addDays(today, -index), disposition: due === 30000 ? "overnight_overtime" : "returned", amount_due_centavos: due, notes: "", updated_at: `${addDays(today, -index)}T08:00:00Z`, units: [{ body_number: unit.body_number }], drivers: [{ full_name: driver.full_name }], remittance_payments: [{ amount_centavos: paid }], unit_id: unit.id, driver_id: driver.id };
});

export const demoDocuments = [
  { id: "00000000-0000-4000-8000-000000000061", document_type: "insurance", document_number: "INS-0001", expires_on: addDays(today, 10), object_path: "demo", lifecycle_status: "current", unit_id: demoUnits[0].id, driver_id: null as string | null, created_at: `${addDays(today, -40)}T08:00:00Z` },
  { id: demoId(6, 2), document_type: "or_cr", document_number: "ORCR-0002", expires_on: addDays(today, -3), object_path: "demo", lifecycle_status: "current", unit_id: demoUnits[1].id, driver_id: null as string | null, created_at: `${addDays(today, -30)}T08:00:00Z` },
  { id: demoId(6, 3), document_type: "mtop_franchise", document_number: "MTOP-0003", expires_on: addDays(today, 2), object_path: "demo", lifecycle_status: "current", unit_id: demoUnits[2].id, driver_id: null as string | null, created_at: `${addDays(today, -20)}T08:00:00Z` },
  { id: demoId(6, 4), document_type: "driver_license", document_number: "N01-23-456790", expires_on: addDays(today, 25), object_path: "demo", lifecycle_status: "current", unit_id: null as string | null, driver_id: demoDrivers[1].id, created_at: `${addDays(today, -10)}T08:00:00Z` },
  ...Array.from({ length: 8 }, (_, index) => ({ id: demoId(6, index + 5), document_type: index % 2 ? "insurance" : "or_cr", document_number: `DOC-${pad(index + 5, 4)}`, expires_on: addDays(today, 120 + index * 15), object_path: "demo", lifecycle_status: "current", unit_id: demoUnits[(index % 8) + 3].id as string | null, driver_id: null as string | null, created_at: `${addDays(today, -60 - index)}T08:00:00Z` })),
];

/** Parts and tires that are past their due date or mileage, for the due-maintenance panel. */
export const demoDueMaintenance = [
  { item_type: "part", item_id: demoId(7, 1), unit_id: demoUnits[0].id, due_date: addDays(today, -12), due_mileage: null as number | null, item_name: "Engine oil", body_number: "T-001", current_mileage: 18240 },
  { item_type: "part", item_id: demoId(7, 2), unit_id: demoUnits[2].id, due_date: null as string | null, due_mileage: 14600, item_name: "Drive chain", body_number: "T-003", current_mileage: 15000 },
  { item_type: "tire", item_id: demoId(7, 3), unit_id: demoUnits[3].id, due_date: addDays(today, -2), due_mileage: null as number | null, item_name: "Rear left tire (Dunlop)", body_number: "T-004", current_mileage: 16375 },
  { item_type: "part", item_id: demoId(7, 4), unit_id: demoUnits[4].id, due_date: addDays(today, -5), due_mileage: 17500, item_name: "Brake shoes", body_number: "T-005", current_mileage: 17750 },
  { item_type: "part", item_id: demoId(7, 5), unit_id: demoUnits[5].id, due_date: today, due_mileage: null as number | null, item_name: "Spark plug", body_number: "T-006", current_mileage: 19125 },
  { item_type: "tire", item_id: demoId(7, 6), unit_id: demoUnits[6].id, due_date: null as string | null, due_mileage: 20000, item_name: "Front tire (IRC)", body_number: "T-007", current_mileage: 20500 },
  { item_type: "part", item_id: demoId(7, 7), unit_id: demoUnits[7].id, due_date: addDays(today, -1), due_mileage: null as number | null, item_name: "Air filter", body_number: "T-008", current_mileage: 21875 },
];

/** When each demo unit in repair went into repair. T-007 has no recorded time. */
export const demoInRepairSince: Record<string, string> = { [demoUnits[1].id]: `${addDays(today, -9)}T02:00:00Z` };

export const demoAuditEvents = Array.from({ length: 15 }, (_, index) => ({ id: 15 - index, occurred_at: `${addDays(today, -index)}T08:00:00Z`, action: index === 14 ? "insert" : index % 3 ? "update" : "insert", entity_type: ["units", "drivers", "remittances", "expenses", "documents"][index % 5] }));
