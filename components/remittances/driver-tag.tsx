import type { DriverOnCard } from "@/lib/remittances/daily-board";

const tagClass = { primary: "bg-info-soft text-info", backup: "bg-brand-soft text-brand-dark" };

/** The Primary (blue) or Backup (amber) tag, shared by Remittances and Drivers (feature 012, FR-004). */
export function RoleTag({ role }: { role: "primary" | "backup" }) {
  return <span className={`status-badge ${tagClass[role]}`}>{role === "backup" ? "Backup" : "Primary"}</span>;
}

/** The driver's name with a Primary or Backup tag: the role the driver had on the card's date (FR-043, feature 012 FR-029). */
export function DriverTag({ driver }: { driver: DriverOnCard }) {
  return <p className="flex min-w-0 flex-wrap items-center gap-1 text-body-sm text-ink">
    <span className="min-w-0 truncate">{driver.name}</span>
    <RoleTag role={driver.role} />
  </p>;
}
