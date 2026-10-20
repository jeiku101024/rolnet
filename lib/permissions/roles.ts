import type { AppRole, ProfileStatus } from "@/types/database";

export type Permission =
  | "manage_master_data"
  | "encode_operations"
  | "manage_documents"
  | "view_dashboard"
  | "export_reports"
  | "manage_users"
  | "view_audit";

const permissions: Record<AppRole, readonly Permission[]> = {
  owner: [
    "manage_master_data",
    "encode_operations",
    "manage_documents",
    "view_dashboard",
    "export_reports",
    "manage_users",
    "view_audit",
  ],
  staff: ["encode_operations"],
};

export function hasPermission(role: AppRole, permission: Permission) {
  return permissions[role].includes(permission);
}

export function isApproved(status: ProfileStatus) {
  return status === "approved";
}
