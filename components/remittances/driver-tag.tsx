import type { DriverOnCard } from "@/lib/remittances/daily-board";

const tagClass = { primary: "bg-info-soft text-info", backup: "bg-brand-soft text-brand-dark" };

/** The driver's name with a Primary or Backup tag from the driver record (FR-043). */
export function DriverTag({ driver }: { driver: DriverOnCard }) {
  return <p className="flex min-w-0 flex-wrap items-center gap-1 text-body-sm text-ink">
    <span className="min-w-0 truncate">{driver.name}</span>
    <span className={`status-badge ${tagClass[driver.role]}`}>{driver.role === "backup" ? "Backup" : "Primary"}</span>
  </p>;
}
