import type { Permission } from "@/lib/permissions/roles";

export interface ResourceConfig {
  table: string;
  idColumn?: string;
  readPermission?: Permission;
  writePermission?: Permission;
  ownerWrite?: boolean;
  createFields: readonly string[];
  updateFields: readonly string[];
  filterFields: readonly string[];
  sortFields: readonly string[];
  includeFields?: readonly string[];
  defaultSort: string;
  defaultAscending?: boolean;
  softDelete?: boolean;
  idempotent?: boolean;
  readOnly?: boolean;
  singleton?: boolean;
  hiddenFields?: readonly string[];
}

const audit = ["created_at", "created_by", "updated_at", "updated_by", "deleted_at", "deleted_by"] as const;
const config = (value: ResourceConfig) => value;

export const resources: Record<string, ResourceConfig> = {
  units: config({ table: "units", ownerWrite: true, createFields: ["name", "body_number", "plate_number", "make_model", "status"], updateFields: ["name", "body_number", "plate_number", "make_model", "status"], filterFields: ["status"], sortFields: ["id", "name", "body_number", "plate_number", "created_at", "updated_at"], defaultSort: "body_number", softDelete: true }),
  drivers: config({ table: "drivers", ownerWrite: true, createFields: ["full_name", "driver_kind", "license_number", "license_expiry_date", "phone", "address", "is_active"], updateFields: ["full_name", "driver_kind", "license_number", "license_expiry_date", "phone", "address", "is_active"], filterFields: ["driver_kind", "is_active"], sortFields: ["id", "full_name", "license_expiry_date", "created_at", "updated_at"], defaultSort: "full_name", softDelete: true }),
  assignments: config({ table: "driver_assignments", ownerWrite: true, createFields: ["unit_id", "driver_id", "assignment_type", "starts_on", "ends_on", "covered_primary_assignment_id", "reason"], updateFields: ["ends_on", "reason"], filterFields: ["unit_id", "driver_id", "assignment_type"], sortFields: ["id", "starts_on", "created_at", "updated_at"], defaultSort: "starts_on", defaultAscending: false, softDelete: true }),
  "driver-days-off": config({ table: "driver_days_off", ownerWrite: true, createFields: ["primary_assignment_id", "day_off_date", "notes"], updateFields: ["day_off_date", "notes"], filterFields: ["primary_assignment_id"], sortFields: ["id", "day_off_date", "created_at", "updated_at"], defaultSort: "day_off_date", defaultAscending: false, softDelete: true }),
  "mileage-readings": config({ table: "mileage_readings", writePermission: "encode_operations", createFields: ["unit_id", "reading_date", "mileage", "notes"], updateFields: ["reading_date", "mileage", "notes"], filterFields: ["unit_id"], sortFields: ["id", "reading_date", "mileage", "created_at", "updated_at"], defaultSort: "reading_date", defaultAscending: false, softDelete: true }),
  "expense-categories": config({ table: "expense_categories", ownerWrite: true, createFields: ["name"], updateFields: ["name"], filterFields: ["is_system", "system_key"], sortFields: ["id", "name", "created_at", "updated_at"], defaultSort: "name", softDelete: true }),
  expenses: config({ table: "expenses", writePermission: "encode_operations", createFields: ["unit_id", "category_id", "expense_date", "amount_centavos", "notes"], updateFields: ["unit_id", "category_id", "expense_date", "amount_centavos", "notes"], filterFields: ["unit_id", "category_id"], sortFields: ["id", "expense_date", "amount_centavos", "created_at", "updated_at"], defaultSort: "expense_date", defaultAscending: false, softDelete: true, idempotent: true, hiddenFields: ["receipt_object_path", "receipt_sha256"] }),
  remittances: config({ table: "remittances", writePermission: "encode_operations", createFields: ["assignment_id", "unit_id", "driver_id", "service_date", "disposition", "notes"], updateFields: ["notes"], filterFields: ["assignment_id", "unit_id", "driver_id", "disposition"], sortFields: ["id", "service_date", "created_at", "updated_at"], defaultSort: "service_date", defaultAscending: false, softDelete: false, idempotent: true }),
  "remittance-payments": config({ table: "remittance_payments", writePermission: "encode_operations", createFields: ["remittance_id", "paid_at", "amount_centavos", "notes"], updateFields: [], filterFields: ["remittance_id"], sortFields: ["id", "paid_at", "created_at"], defaultSort: "paid_at", defaultAscending: false, softDelete: false, idempotent: true }),
  "part-replacements": config({ table: "part_replacements", writePermission: "encode_operations", createFields: ["unit_id", "part_name", "cost_centavos", "replaced_on", "replacement_mileage", "next_due_date", "next_due_mileage", "notes"], updateFields: ["part_name", "cost_centavos", "replaced_on", "replacement_mileage", "next_due_date", "next_due_mileage", "notes"], filterFields: ["unit_id"], sortFields: ["id", "replaced_on", "created_at", "updated_at"], defaultSort: "replaced_on", defaultAscending: false, softDelete: true }),
  "tire-installations": config({ table: "tire_installations", writePermission: "encode_operations", createFields: ["unit_id", "position", "brand", "installed_on", "installed_mileage", "cost_centavos", "next_due_date", "next_due_mileage"], updateFields: ["brand", "next_due_date", "next_due_mileage"], filterFields: ["unit_id", "position"], sortFields: ["id", "installed_on", "created_at", "updated_at"], defaultSort: "installed_on", defaultAscending: false, softDelete: true }),
  documents: config({ table: "documents", readPermission: "manage_documents", writePermission: "manage_documents", ownerWrite: true, createFields: ["document_type", "unit_id", "driver_id", "document_number", "issued_on", "expires_on", "lifecycle_status", "object_path", "mime_type", "size_bytes", "sha256", "superseded_by_id"], updateFields: ["document_number", "issued_on"], filterFields: ["document_type", "unit_id", "driver_id", "lifecycle_status"], sortFields: ["id", "expires_on", "created_at", "updated_at"], defaultSort: "expires_on", softDelete: true, idempotent: true, hiddenFields: ["object_path", "sha256"] }),
  profiles: config({ table: "profiles", idColumn: "user_id", readPermission: "manage_users", ownerWrite: true, createFields: [], updateFields: ["display_name"], filterFields: ["role", "account_status"], sortFields: ["user_id", "display_name", "created_at", "updated_at"], defaultSort: "display_name", softDelete: false }),
  "fleet-settings": config({ table: "fleet_settings", idColumn: "id", ownerWrite: true, singleton: true, createFields: [], updateFields: ["fleet_name", "timezone"], filterFields: [], sortFields: ["updated_at"], defaultSort: "updated_at" }),
  "audit-events": config({ table: "audit_events", idColumn: "id", readPermission: "view_audit", readOnly: true, createFields: [], updateFields: [], filterFields: ["entity_type", "entity_id", "actor_user_id", "action"], sortFields: ["id", "occurred_at"], defaultSort: "occurred_at", defaultAscending: false, hiddenFields: [] }),
};

export const auditFields = audit;
