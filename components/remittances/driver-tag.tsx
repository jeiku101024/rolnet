"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DriverOnCard } from "@/lib/remittances/daily-board";

const tagClass = { primary: "bg-info-soft text-info", backup: "bg-brand-soft text-brand-dark" };

/** The driver's name with a Primary or Backup tag; a covering backup explains whom it covers (FR-012, FR-015). */
export function DriverTag({ driver }: { driver: DriverOnCard }) {
  const label = driver.role === "backup" ? "Backup" : "Primary";
  const tag = `status-badge ${tagClass[driver.role]}`;
  return <p className="flex min-w-0 flex-wrap items-center gap-1 text-body-sm text-ink">
    <span className="min-w-0 truncate">{driver.name}</span>
    {driver.coveringFor ? <Tooltip>
      <TooltipTrigger className={`${tag} cursor-help`} aria-label={`Backup, covering for ${driver.coveringFor}, day off`}>{label}</TooltipTrigger>
      <TooltipContent>Covering for {driver.coveringFor}, day off.</TooltipContent>
    </Tooltip> : <span className={tag}>{label}</span>}
  </p>;
}
