/**
 * Driver and unit statuses (feature 005, data-model.md). Drivers store `is_active`; units store
 * `unit_status`. Inactive drivers and In repair or Retired units have locked details.
 */
export type UnitStatus = "active" | "in_repair" | "retired";
export type DriverStatus = "active" | "inactive";
export type StatusTone = "success" | "warning" | "danger" | "muted";

export const unitStatusOptions: { value: UnitStatus; label: string; tone: StatusTone }[] = [
  { value: "active", label: "Active", tone: "success" },
  { value: "in_repair", label: "In repair", tone: "warning" },
  { value: "retired", label: "Retired", tone: "danger" },
];

export const driverStatusOptions: { value: DriverStatus; label: string; tone: StatusTone }[] = [
  { value: "active", label: "Active", tone: "success" },
  { value: "inactive", label: "Inactive", tone: "danger" },
];

export function unitStatusLabel(status: UnitStatus) {
  return unitStatusOptions.find((option) => option.value === status)?.label ?? status;
}

export function driverStatusLabel(status: DriverStatus) {
  return status === "active" ? "Active" : "Inactive";
}

export function unitStatusTone(status: UnitStatus): StatusTone {
  return unitStatusOptions.find((option) => option.value === status)?.tone ?? "muted";
}

export function driverStatusOf(isActive: boolean): DriverStatus {
  return isActive ? "active" : "inactive";
}

export function isUnitLocked(status: UnitStatus) {
  return status === "in_repair" || status === "retired";
}

export function isDriverLocked(isActive: boolean) {
  return !isActive;
}

/** Notice shown on a locked record's page (contracts/status-actions.md). */
export function lockedMessage(kind: "unit", status: UnitStatus): string;
export function lockedMessage(kind: "driver", status: DriverStatus): string;
export function lockedMessage(kind: "unit" | "driver", status: UnitStatus | DriverStatus) {
  if (kind === "driver") return "This driver is Inactive. Set the status to Active to edit their details.";
  return `This unit is ${unitStatusLabel(status as UnitStatus)}. Set the status to Active to edit its details.`;
}
