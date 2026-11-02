import { StatusBadge } from "@/components/ui/feedback";
import { fleetToday } from "@/lib/dates/fleet-date";
import { documentStatus, documentStatusLabels, documentStatusTones } from "@/lib/documents/status";

// Status is derived from the fleet's calendar date (Asia/Manila, FR-025), computed when the page
// renders on the server, so it does not depend on the viewer's device clock or time zone. Feature 013
// uses three tiers everywhere (FR-011a); the badge keeps its text and icon, not just colour.
export function ExpiryStatus({ expiresOn, today = fleetToday() }: { expiresOn: string; today?: string }) {
  const status = documentStatus(expiresOn, today);
  return <StatusBadge label={documentStatusLabels[status]} tone={documentStatusTones[status]} />;
}
