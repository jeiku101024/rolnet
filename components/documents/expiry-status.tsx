"use client";

import { useSyncExternalStore } from "react";
import { StatusBadge } from "@/components/ui/feedback";

// "Today" comes from the device clock, so it is only read on the client; the server render and
// hydration show "Checking" to avoid a server/client mismatch.
const subscribe = () => () => {};
const getTodayStart = () => new Date().setHours(0, 0, 0, 0);
const getServerTodayStart = () => null;

export function ExpiryStatus({ expiresOn }: { expiresOn: string }) {
  const todayStart = useSyncExternalStore(subscribe, getTodayStart, getServerTodayStart);
  if (todayStart === null) return <StatusBadge label="Checking" tone="muted" />;
  const days = Math.ceil((new Date(`${expiresOn}T00:00:00`).getTime() - todayStart) / 86400000);
  const label = days < 0 ? "Expired" : days <= 7 ? "Due within 7 days" : days <= 30 ? "Due within 30 days" : "Valid";
  return <StatusBadge label={label} tone={days < 0 ? "danger" : days <= 30 ? "warning" : "success"} />;
}
