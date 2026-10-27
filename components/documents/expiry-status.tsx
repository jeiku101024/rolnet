"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/feedback";

export function ExpiryStatus({ expiresOn }: { expiresOn: string }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => { const today = new Date(); today.setHours(0, 0, 0, 0); setDays(Math.ceil((new Date(`${expiresOn}T00:00:00`).getTime() - today.getTime()) / 86400000)); }, [expiresOn]);
  if (days === null) return <StatusBadge label="Checking" tone="muted" />;
  const label = days < 0 ? "Expired" : days <= 7 ? "Due within 7 days" : days <= 30 ? "Due within 30 days" : "Valid";
  return <StatusBadge label={label} tone={days < 0 ? "danger" : days <= 30 ? "warning" : "success"} />;
}
