export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const demoMasterEmail = process.env.DEMO_MASTER_EMAIL || "owner@demo.local";
export const demoMasterPassword = process.env.DEMO_MASTER_PASSWORD || "demo1234";

export const demoUnits = [
  { id: "00000000-0000-4000-8000-000000000001", body_number: "T-001", plate_number: "ABC-1234", make_model: "Honda TMX", status: "active", current_mileage: 18240 },
  { id: "00000000-0000-4000-8000-000000000002", body_number: "T-002", plate_number: "ABC-1235", make_model: "Yamaha YTX", status: "in_repair", current_mileage: 24110 },
];
export const demoDrivers = [
  { id: "00000000-0000-4000-8000-000000000011", full_name: "Juan Dela Cruz", driver_kind: "primary", license_number: "N01-23-456789", license_expiry_date: "2027-06-30", phone: "09171234567", is_active: true },
  { id: "00000000-0000-4000-8000-000000000012", full_name: "Pedro Santos", driver_kind: "backup", license_number: "N01-23-456790", license_expiry_date: "2027-03-15", phone: "09181234567", is_active: true },
];
export const demoCategories = [
  { id: "00000000-0000-4000-8000-000000000021", name: "Fuel" },
  { id: "00000000-0000-4000-8000-000000000022", name: "Repairs" },
  { id: "00000000-0000-4000-8000-000000000023", name: "Registration" },
  { id: "00000000-0000-4000-8000-000000000024", name: "Insurance" },
];
export const demoAssignments = [{ id: "00000000-0000-4000-8000-000000000031", assignment_type: "primary", starts_on: "2026-01-01", ends_on: null, units: [{ body_number: "T-001" }], drivers: [{ full_name: "Juan Dela Cruz" }] }];
export const demoExpenses = [{ id: "00000000-0000-4000-8000-000000000041", expense_date: "2026-10-05", amount_centavos: 185000, notes: "Monthly tune-up", receipt_object_path: null, units: [{ body_number: "T-001" }], expense_categories: [{ name: "Repairs" }] }];
export const demoRemittances = [{ id: "00000000-0000-4000-8000-000000000051", service_date: "2026-10-19", disposition: "returned", amount_due_centavos: 18000, notes: "", updated_at: "2026-10-19T08:00:00Z", units: [{ body_number: "T-001" }], drivers: [{ full_name: "Juan Dela Cruz" }], remittance_payments: [{ amount_centavos: 18000 }] }];
export const demoDocuments = [{ id: "00000000-0000-4000-8000-000000000061", document_type: "insurance", expires_on: "2026-11-10", object_path: "demo", lifecycle_status: "current" }];
export const demoAuditEvents = [{ id: 1, occurred_at: "2026-10-19T08:00:00Z", action: "insert", entity_type: "units" }];
