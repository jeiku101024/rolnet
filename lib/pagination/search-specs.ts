import type { SearchSpec } from "@/lib/pagination/search-filter";
import { documentTypeLabels } from "@/lib/validation/documents";

/**
 * What each server-paged list's search box looks through (contracts/list-paging.md, "Search
 * covers"). Lists inside detail pages are already fully loaded for their coverage logic, so they
 * page and search in memory with `pageRows` instead.
 */

export const unitStatusLabels: Record<string, string> = { active: "Active", in_repair: "In repair", retired: "Retired" };
export const driverKindLabels: Record<string, string> = { primary: "Primary", backup: "Backup (extrador)" };
export const dispositionLabels: Record<string, string> = { returned: "Returned", overnight_overtime: "Overnight / overtime" };
export const auditActionLabels: Record<string, string> = { insert: "Created", update: "Updated", soft_delete: "Archived", restore: "Restored", reverse: "Reversed" };
export const accountStatusLabels: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", deactivated: "Deactivated" };

const unitLink = { table: "units", column: "body_number", foreignKey: "unit_id" } as const;
const driverLink = { table: "drivers", column: "full_name", foreignKey: "driver_id" } as const;

export const searchSpecs = {
  units: { columns: ["body_number", "plate_number", "make_model"], enums: [{ column: "status", labels: unitStatusLabels }] },
  drivers: { columns: ["full_name", "license_number", "phone"], enums: [{ column: "driver_kind", labels: driverKindLabels }] },
  remittances: { columns: ["notes"], related: [unitLink, driverLink], enums: [{ column: "disposition", labels: dispositionLabels }], dateColumn: "service_date", amountColumn: "amount_due_centavos" },
  expenses: { columns: ["notes"], related: [unitLink, { table: "expense_categories", column: "name", foreignKey: "category_id" }], dateColumn: "expense_date", amountColumn: "amount_centavos" },
  maintenanceUnits: { columns: ["body_number", "plate_number"] },
  documents: { columns: ["document_number"], related: [unitLink, driverLink], enums: [{ column: "document_type", labels: documentTypeLabels }], dateColumn: "expires_on" },
  audit: { columns: ["entity_type"], enums: [{ column: "action", labels: auditActionLabels }] },
  staff: { columns: ["display_name"], enums: [{ column: "account_status", labels: accountStatusLabels }] },
} satisfies Record<string, SearchSpec>;
