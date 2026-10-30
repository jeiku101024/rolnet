import type { ControlsSpec, FilterOption } from "@/lib/pagination/list-controls";
import { bucketLabels } from "@/lib/pagination/list-controls";
import { accountStatusLabels, auditActionLabels, dispositionLabels, driverKindLabels, unitStatusLabels } from "@/lib/pagination/search-specs";
import { documentTypeLabels } from "@/lib/validation/documents";

/** Sorts and filters of each main list (contracts/list-paging.md, "Sort and filter"). The first sort is the default. */

const optionsOf = (labels: Record<string, string>): FilterOption[] => Object.entries(labels).map(([value, label]) => ({ value, label }));
const expiryBuckets = bucketLabels;
const licenseBuckets = bucketLabels.filter((option) => option.value !== "due");

export const auditEntityLabels: Record<string, string> = {
  units: "Units", drivers: "Drivers", driver_assignments: "Assignments", driver_days_off: "Days off", remittances: "Remittances", remittance_payments: "Payments",
  expenses: "Expenses", expense_categories: "Expense categories", documents: "Documents", part_replacements: "Part replacements", tire_installations: "Tires",
  mileage_readings: "Mileage readings", profiles: "Staff accounts", fleet_settings: "Fleet settings",
};

export const listControlSpecs = {
  units: {
    sorts: [
      { value: "body", label: "Body number, A to Z", column: "body_number", ascending: true },
      { value: "body-desc", label: "Body number, Z to A", column: "body_number", ascending: false },
      { value: "mileage-desc", label: "Mileage, highest first", column: "current_mileage", ascending: false, then: [{ column: "body_number", ascending: true }] },
      { value: "mileage", label: "Mileage, lowest first", column: "current_mileage", ascending: true, then: [{ column: "body_number", ascending: true }] },
    ],
    filters: [{ kind: "eq", param: "status", label: "Status", column: "status", options: optionsOf(unitStatusLabels) }],
  },
  drivers: {
    sorts: [
      { value: "name", label: "Name, A to Z", column: "full_name", ascending: true },
      { value: "name-desc", label: "Name, Z to A", column: "full_name", ascending: false },
      { value: "license", label: "License expiry, soonest first", column: "license_expiry_date", ascending: true, then: [{ column: "full_name", ascending: true }] },
      { value: "license-desc", label: "License expiry, latest first", column: "license_expiry_date", ascending: false, then: [{ column: "full_name", ascending: true }] },
    ],
    filters: [
      { kind: "eq", param: "kind", label: "Role", column: "driver_kind", options: optionsOf(driverKindLabels) },
      { kind: "eq", param: "status", label: "Status", column: "is_active", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }], values: { active: true, inactive: false } },
      { kind: "bucket", param: "license", label: "License expiry", column: "license_expiry_date", options: licenseBuckets },
    ],
  },
  remittances: {
    sorts: [
      { value: "newest", label: "Newest first", column: "service_date", ascending: false, then: [{ column: "created_at", ascending: false }] },
      { value: "oldest", label: "Oldest first", column: "service_date", ascending: true, then: [{ column: "created_at", ascending: true }] },
      { value: "amount-desc", label: "Amount due, highest first", column: "amount_due_centavos", ascending: false, then: [{ column: "service_date", ascending: false }] },
      { value: "amount", label: "Amount due, lowest first", column: "amount_due_centavos", ascending: true, then: [{ column: "service_date", ascending: false }] },
    ],
    filters: [
      { kind: "range", label: "Service date", column: "service_date" },
      { kind: "eq", param: "unit", label: "Unit", column: "unit_id", options: [] },
      { kind: "eq", param: "driver", label: "Driver", column: "driver_id", options: [] },
      { kind: "eq", param: "disposition", label: "Disposition", column: "disposition", options: optionsOf(dispositionLabels) },
      { kind: "page", param: "balance", label: "Balance", options: [{ value: "unpaid", label: "Unpaid balance" }], ownerOnly: true },
    ],
  },
  expenses: {
    sorts: [
      { value: "newest", label: "Newest first", column: "expense_date", ascending: false, then: [{ column: "created_at", ascending: false }] },
      { value: "oldest", label: "Oldest first", column: "expense_date", ascending: true, then: [{ column: "created_at", ascending: true }] },
      { value: "amount-desc", label: "Amount, highest first", column: "amount_centavos", ascending: false, then: [{ column: "expense_date", ascending: false }] },
      { value: "amount", label: "Amount, lowest first", column: "amount_centavos", ascending: true, then: [{ column: "expense_date", ascending: false }] },
    ],
    filters: [
      { kind: "range", label: "Expense date", column: "expense_date" },
      { kind: "eq", param: "unit", label: "Unit", column: "unit_id", options: [] },
      { kind: "eq", param: "category", label: "Category", column: "category_id", options: [] },
      { kind: "presence", param: "receipt", label: "Receipt", options: [{ value: "attached", label: "Attached", column: "receipt_object_path", present: true }, { value: "missing", label: "Missing", column: "receipt_object_path", present: false }] },
    ],
  },
  maintenance: {
    sorts: [
      { value: "body", label: "Body number, A to Z", column: "body_number", ascending: true },
      { value: "body-desc", label: "Body number, Z to A", column: "body_number", ascending: false },
      { value: "mileage-desc", label: "Mileage, highest first", column: "current_mileage", ascending: false, then: [{ column: "body_number", ascending: true }] },
      { value: "mileage", label: "Mileage, lowest first", column: "current_mileage", ascending: true, then: [{ column: "body_number", ascending: true }] },
    ],
    filters: [
      { kind: "eq", param: "status", label: "Unit status", column: "status", options: optionsOf(unitStatusLabels) },
      { kind: "page", param: "due", label: "Maintenance", options: [{ value: "1", label: "Has maintenance due" }], ownerOnly: true },
    ],
  },
  documents: {
    sorts: [
      { value: "expiry", label: "Expiry, soonest first", column: "expires_on", ascending: true, then: [{ column: "id", ascending: true }] },
      { value: "expiry-desc", label: "Expiry, latest first", column: "expires_on", ascending: false, then: [{ column: "id", ascending: true }] },
      { value: "type", label: "Type, A to Z", column: "document_type", ascending: true, then: [{ column: "expires_on", ascending: true }] },
      { value: "newest", label: "Newest upload first", column: "created_at", ascending: false },
    ],
    filters: [
      { kind: "eq", param: "type", label: "Type", column: "document_type", options: optionsOf(documentTypeLabels) },
      { kind: "presence", param: "holder", label: "Holder", options: [{ value: "unit", label: "Units", column: "unit_id", present: true }, { value: "driver", label: "Drivers", column: "driver_id", present: true }] },
      { kind: "bucket", param: "expiry", label: "Expiry", column: "expires_on", options: expiryBuckets },
    ],
  },
  audit: {
    sorts: [
      { value: "newest", label: "Newest first", column: "occurred_at", ascending: false, then: [{ column: "id", ascending: false }] },
      { value: "oldest", label: "Oldest first", column: "occurred_at", ascending: true, then: [{ column: "id", ascending: true }] },
    ],
    filters: [
      { kind: "range", label: "Date", column: "occurred_at", timestamp: true },
      { kind: "eq", param: "action", label: "Action", column: "action", options: optionsOf(auditActionLabels) },
      { kind: "eq", param: "entity", label: "Record type", column: "entity_type", options: optionsOf(auditEntityLabels) },
    ],
  },
  staff: {
    sorts: [
      { value: "newest", label: "Newest registration first", column: "created_at", ascending: false },
      { value: "oldest", label: "Oldest registration first", column: "created_at", ascending: true },
      { value: "name", label: "Name, A to Z", column: "display_name", ascending: true },
    ],
    filters: [{ kind: "eq", param: "status", label: "Account status", column: "account_status", options: optionsOf(accountStatusLabels) }],
  },
} satisfies Record<string, ControlsSpec>;
