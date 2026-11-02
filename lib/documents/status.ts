import { addDays } from "@/lib/dates/fleet-date";
import type { StatusBadgeTone } from "@/components/ui/feedback";

// Feature 013 (FR-010, FR-011a): one 3-tier status for every document badge, from the fleet's
// calendar date (Asia/Manila), so a document shows the same status on every page.

export type DocumentStatus = "expired" | "due" | "valid";

export const documentStatuses: DocumentStatus[] = ["expired", "due", "valid"];

export const documentStatusLabels: Record<DocumentStatus, string> = {
  expired: "Expired",
  due: "Due within 7 days",
  valid: "Valid",
};

export const documentStatusTones: Record<DocumentStatus, StatusBadgeTone> = {
  expired: "danger",
  due: "warning",
  valid: "success",
};

/** Expired before today; due from today through 7 days ahead (inclusive); valid after that. */
export function documentStatus(expiresOn: string, today: string): DocumentStatus {
  if (expiresOn < today) return "expired";
  if (expiresOn <= addDays(today, 7)) return "due";
  return "valid";
}
