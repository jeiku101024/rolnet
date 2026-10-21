"use client";

import { useMemo } from "react";
import { StatusBadge } from "@/components/ui/feedback";

export function ExpiryStatus({ expiresOn }: { expiresOn: string }) {
  const days = useMemo(() => Math.ceil((new Date(`${expiresOn}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000), [expiresOn]);
  const label = days < 0 ? "Expired" : days <= 7 ? "Due within 7 days" : days <= 30 ? "Due within 30 days" : "Valid";
  return <StatusBadge label={label} tone={days < 0 ? "danger" : days <= 30 ? "warning" : "success"} />;
}
